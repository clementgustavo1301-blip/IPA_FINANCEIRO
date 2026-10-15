package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

// AntiBanConfig configurações de anti-ban e fila
type AntiBanConfig struct {
	DailyLimit    int    `json:"daily_limit"`     // Máximo de mensagens por dia (padrão: 15)
	MinDelaySec   int    `json:"min_delay_sec"`   // Espaçamento mínimo entre mensagens em segundos (padrão: 20)
	MaxDelaySec   int    `json:"max_delay_sec"`   // Espaçamento máximo entre mensagens em segundos (padrão: 45)
	TypingSpeedMs int    `json:"typing_speed_ms"` // Velocidade de digitação em ms por caractere (padrão: 100)
	MinTypingSec  int    `json:"min_typing_sec"`  // Mínimo de tempo digitando em segundos (padrão: 2)
	MaxTypingSec  int    `json:"max_typing_sec"`  // Máximo de tempo digitando em segundos (padrão: 15)
	SentToday     int    `json:"sent_today"`      // Mensagens enviadas no dia atual
	LastResetDate string `json:"last_reset_date"` // YYYY-MM-DD
}

// QueueItem item da fila de mensagens
type QueueItem struct {
	ID            string     `json:"id"`
	Phone         string     `json:"phone"`
	Message       string     `json:"message"`
	MediaURL      string     `json:"media_url,omitempty"`
	SolicitacaoID string     `json:"solicitacao_id,omitempty"`
	Status        string     `json:"status"` // "queued", "typing", "sent", "failed", "limit_reached"
	CreatedAt     time.Time  `json:"created_at"`
	SentAt        *time.Time `json:"sent_at,omitempty"`
	Error         string     `json:"error,omitempty"`
}

var (
	container      *sqlstore.Container
	clientLog      waLog.Logger
	client         *whatsmeow.Client
	qrCodeMutex    sync.RWMutex
	currentQRCode  string
	currentQRImage string
	isConnecting   bool
	connectMutex   sync.Mutex

	configMutex   sync.RWMutex
	currentConfig AntiBanConfig

	queueMutex  sync.RWMutex
	activeQueue []*QueueItem
	queueNotify = make(chan struct{}, 100)
)

const configFile = "antiban_config.json"

func todayStr() string {
	return time.Now().Format("2006-01-02")
}

func loadConfig() {
	configMutex.Lock()
	defer configMutex.Unlock()

	// Padrões
	currentConfig = AntiBanConfig{
		DailyLimit:    15,
		MinDelaySec:   20,
		MaxDelaySec:   45,
		TypingSpeedMs: 100,
		MinTypingSec:  2,
		MaxTypingSec:  15,
		SentToday:     0,
		LastResetDate: todayStr(),
	}

	data, err := os.ReadFile(configFile)
	if err == nil {
		_ = json.Unmarshal(data, &currentConfig)
	}

	// Verifica se virou o dia para resetar o contador
	if currentConfig.LastResetDate != todayStr() {
		currentConfig.SentToday = 0
		currentConfig.LastResetDate = todayStr()
		saveConfigUnsafe()
	}
}

func saveConfigUnsafe() {
	data, err := json.MarshalIndent(currentConfig, "", "  ")
	if err == nil {
		_ = os.WriteFile(configFile, data, 0644)
	}
}

func saveConfig() {
	configMutex.Lock()
	defer configMutex.Unlock()
	saveConfigUnsafe()
}

func checkResetDay() {
	configMutex.Lock()
	defer configMutex.Unlock()
	if currentConfig.LastResetDate != todayStr() {
		currentConfig.SentToday = 0
		currentConfig.LastResetDate = todayStr()
		saveConfigUnsafe()
		log.Println("[Anti-Ban] Novo dia iniciado. Contador diário resetado para 0.")
	}
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
}

func setupClientEvents() {
	if client == nil {
		return
	}
	client.AddEventHandler(func(evt interface{}) {
		switch evt.(type) {
		case *events.Connected:
			log.Println("[WhatsApp] Evento: Conexão Estabelecida.")
		case *events.LoggedOut:
			log.Println("[WhatsApp] Evento: Desconectado/Deslogado.")
			setupNewDeviceAndClient()
		}
	})
}

func setupNewDeviceAndClient() {
	if client != nil && client.IsConnected() {
		client.Disconnect()
	}
	if container != nil {
		deviceStore := container.NewDevice()
		client = whatsmeow.NewClient(deviceStore, clientLog)
		setupClientEvents()
	}
	qrCodeMutex.Lock()
	currentQRCode = ""
	currentQRImage = ""
	qrCodeMutex.Unlock()
	log.Println("[WhatsApp] Novo dispositivo Whatsmeow inicializado pronto para QR Code.")
}

func startPairing() error {
	connectMutex.Lock()
	defer connectMutex.Unlock()

	if client == nil {
		return fmt.Errorf("cliente whatsmeow não inicializado")
	}

	if client.IsConnected() && client.IsLoggedIn() {
		return nil
	}

	if isConnecting {
		return nil
	}

	isConnecting = true
	go func() {
		defer func() {
			connectMutex.Lock()
			isConnecting = false
			connectMutex.Unlock()
		}()

		if client.Store == nil || client.Store.ID == nil {
			qrChan, err := client.GetQRChannel(context.Background())
			if err != nil {
				log.Printf("[WhatsApp] Erro ao obter canal QR: %v", err)
				if strings.Contains(err.Error(), "deleted device") {
					setupNewDeviceAndClient()
					var errQR error
					qrChan, errQR = client.GetQRChannel(context.Background())
					if errQR != nil {
						log.Printf("[WhatsApp] Falha ao recriar canal QR: %v", errQR)
						return
					}
				} else {
					return
				}
			}

			err = client.Connect()
			if err != nil {
				log.Printf("[WhatsApp] Erro ao conectar: %v", err)
				if strings.Contains(err.Error(), "deleted device") {
					setupNewDeviceAndClient()
					qrChan, errQR := client.GetQRChannel(context.Background())
					if errQR == nil {
						_ = client.Connect()
						for evt := range qrChan {
							if evt.Event == "code" {
								qrCodeMutex.Lock()
								currentQRCode = evt.Code
								png, errPng := qrcode.Encode(evt.Code, qrcode.Medium, 256)
								if errPng == nil {
									currentQRImage = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
								}
								qrCodeMutex.Unlock()
								log.Println("[WhatsApp] Novo QR Code gerado para escaneamento.")
							} else if evt.Event == "success" {
								qrCodeMutex.Lock()
								currentQRCode = ""
								currentQRImage = ""
								qrCodeMutex.Unlock()
								log.Println("[WhatsApp] Login efetuado com sucesso!")
							}
						}
					}
				}
				return
			}

			for evt := range qrChan {
				if evt.Event == "code" {
					qrCodeMutex.Lock()
					currentQRCode = evt.Code
					png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256)
					if err == nil {
						currentQRImage = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
					}
					qrCodeMutex.Unlock()
					log.Println("[WhatsApp] Novo QR Code gerado para escaneamento.")
				} else if evt.Event == "success" {
					qrCodeMutex.Lock()
					currentQRCode = ""
					currentQRImage = ""
					qrCodeMutex.Unlock()
					log.Println("[WhatsApp] Login efetuado com sucesso!")
				} else if evt.Event == "timeout" {
					log.Println("[WhatsApp] QR Code expirou.")
				}
			}
		} else {
			err := client.Connect()
			if err != nil {
				log.Printf("[WhatsApp] Erro ao reconectar sessão: %v", err)
				if strings.Contains(err.Error(), "deleted device") || strings.Contains(err.Error(), "401") {
					log.Println("[WhatsApp] Sessão inválida/deletada detectada. Criando novo dispositivo...")
					setupNewDeviceAndClient()
					qrChan, errQR := client.GetQRChannel(context.Background())
					if errQR == nil {
						_ = client.Connect()
						for evt := range qrChan {
							if evt.Event == "code" {
								qrCodeMutex.Lock()
								currentQRCode = evt.Code
								png, errPng := qrcode.Encode(evt.Code, qrcode.Medium, 256)
								if errPng == nil {
									currentQRImage = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
								}
								qrCodeMutex.Unlock()
								log.Println("[WhatsApp] Novo QR Code gerado para escaneamento.")
							} else if evt.Event == "success" {
								qrCodeMutex.Lock()
								currentQRCode = ""
								currentQRImage = ""
								qrCodeMutex.Unlock()
								log.Println("[WhatsApp] Login efetuado com sucesso!")
							}
						}
					}
				}
			} else {
				log.Println("[WhatsApp] Reconectado com sucesso usando sessão salva.")
			}
		}
	}()

	return nil
}

func normalizePhone(rawPhone string) string {
	clean := strings.TrimSpace(rawPhone)
	clean = strings.ReplaceAll(clean, "+", "")
	clean = strings.ReplaceAll(clean, "-", "")
	clean = strings.ReplaceAll(clean, " ", "")
	clean = strings.ReplaceAll(clean, "(", "")
	clean = strings.ReplaceAll(clean, ")", "")
	clean = strings.ReplaceAll(clean, ".", "")

	// Se for número brasileiro sem 55 (10 ou 11 dígitos), adiciona 55
	if (len(clean) == 10 || len(clean) == 11) && !strings.HasPrefix(clean, "55") {
		clean = "55" + clean
	}
	return clean
}

func resolveContactJID(ctx context.Context, phone string) (types.JID, string, error) {
	if client == nil || !client.IsConnected() {
		return types.EmptyJID, "", fmt.Errorf("cliente WhatsApp desconectado")
	}

	cleanPhone := normalizePhone(phone)
	var candidates []string
	candidates = append(candidates, cleanPhone)

	// Tratamento especial para números brasileiros (DDI 55):
	// Contas no Brasil frequentemente foram registradas com 8 dígitos ou com 9 dígitos.
	if strings.HasPrefix(cleanPhone, "55") {
		// Se tem 13 dígitos e começa com 9 após o DDD (ex: 55 84 9 87202773)
		if len(cleanPhone) == 13 && cleanPhone[4] == '9' {
			// Adiciona versão de 8 dígitos (sem o 9): ex: 55 84 87202773
			without9 := cleanPhone[:4] + cleanPhone[5:]
			candidates = append(candidates, without9)
		} else if len(cleanPhone) == 12 {
			// Adiciona versão com 9 dígitos inserido: ex: 55 84 9 87202773
			with9 := cleanPhone[:4] + "9" + cleanPhone[4:]
			candidates = append(candidates, with9)
		}
	}

	var queryNumbers []string
	for _, c := range candidates {
		queryNumbers = append(queryNumbers, "+"+c)
	}

	log.Printf("[WhatsApp] Verificando registro e mapeando LID no WhatsApp: %v", queryNumbers)
	results, err := client.IsOnWhatsApp(ctx, queryNumbers)
	if err == nil && len(results) > 0 {
		for _, res := range results {
			if res.IsIn {
				// No WhatsApp Multi-Device, 1-on-1 chats SEMPRE usam @s.whatsapp.net (Phone Number JID).
				// res.JID frequentemente contém o identificador LID (@lid), que NÃO deve ser usado como destinatário do chat.
				var targetJID types.JID
				var targetPhone string

				if !res.PhoneNumber.IsEmpty() && res.PhoneNumber.Server == types.DefaultUserServer {
					targetJID = res.PhoneNumber
					targetPhone = res.PhoneNumber.User
				} else if res.JID.Server == types.DefaultUserServer {
					targetJID = res.JID
					targetPhone = res.JID.User
				} else {
					targetPhone = strings.TrimPrefix(res.Query, "+")
					targetJID = types.NewJID(targetPhone, types.DefaultUserServer)
				}

				log.Printf("[WhatsApp] Contato verificado! Query: %s -> JID Destino: %s (LID: %s)", res.Query, targetJID.String(), res.JID.String())
				return targetJID, targetPhone, nil
			}
		}
		return types.EmptyJID, "", fmt.Errorf("o número +%s não possui conta ativa no WhatsApp (verifique o DDD e o número)", cleanPhone)
	}

	if err != nil {
		log.Printf("[WhatsApp] Aviso ao consultar IsOnWhatsApp (%v). Prosseguindo com JID padrão...", err)
	}

	fallbackJID := types.NewJID(cleanPhone, types.DefaultUserServer)
	return fallbackJID, cleanPhone, nil
}

// worker responsável por processar a fila com digitação e espaçamento
func startQueueWorker() {
	go func() {
		r := rand.New(rand.NewSource(time.Now().UnixNano()))

		for {
			checkResetDay()

			var nextItem *QueueItem
			queueMutex.Lock()
			for _, item := range activeQueue {
				if item.Status == "queued" {
					nextItem = item
					break
				}
			}
			queueMutex.Unlock()

			if nextItem == nil {
				// Aguarda nova notificação de mensagem na fila
				select {
				case <-queueNotify:
				case <-time.After(3 * time.Second):
				}
				continue
			}

			// Verifica limite diário
			configMutex.RLock()
			limit := currentConfig.DailyLimit
			sent := currentConfig.SentToday
			minDelay := currentConfig.MinDelaySec
			maxDelay := currentConfig.MaxDelaySec
			speedMs := currentConfig.TypingSpeedMs
			minTyping := currentConfig.MinTypingSec
			maxTyping := currentConfig.MaxTypingSec
			configMutex.RUnlock()

			if sent >= limit {
				queueMutex.Lock()
				nextItem.Status = "limit_reached"
				nextItem.Error = fmt.Sprintf("Limite diário de %d mensagens atingido", limit)
				queueMutex.Unlock()
				log.Printf("[Anti-Ban] Limite diário (%d) atingido. Mensagem %s aguardando próximo dia.", limit, nextItem.ID)
				time.Sleep(10 * time.Second)
				continue
			}

			// Verifica se cliente está conectado
			if client == nil || !client.IsConnected() || !client.IsLoggedIn() {
				log.Println("[Queue] Cliente WhatsApp desconectado. Aguardando reconexão...")
				time.Sleep(5 * time.Second)
				continue
			}

			// 1. Resolve o destinatário no WhatsApp (resolvendo LID e formato de 8/9 dígitos no Brasil)
			cleanPhone := normalizePhone(nextItem.Phone)
			recipientJID, resolvedPhone, err := resolveContactJID(context.Background(), cleanPhone)
			if err != nil {
				queueMutex.Lock()
				nextItem.Status = "failed"
				nextItem.Error = err.Error()
				queueMutex.Unlock()
				log.Printf("[Queue] Erro ao resolver número %s: %v", cleanPhone, err)
				continue
			}

			if resolvedPhone != cleanPhone {
				log.Printf("[Queue] Contato %s resolvido para número oficial registrado no WhatsApp: %s (JID: %s)", cleanPhone, resolvedPhone, recipientJID.String())
			}

			queueMutex.Lock()
			nextItem.Status = "typing"
			queueMutex.Unlock()

			// Calcula tempo de digitação baseado no tamanho do texto
			textLen := len(nextItem.Message)
			calculatedTypingMs := textLen * speedMs

			// Aplica limites de digitação
			typingDurationSec := float64(calculatedTypingMs) / 1000.0
			if typingDurationSec < float64(minTyping) {
				typingDurationSec = float64(minTyping)
			}
			if typingDurationSec > float64(maxTyping) {
				typingDurationSec = float64(maxTyping)
			}

			// Adiciona pequena variação aleatória de 15% (jitter humano)
			jitter := (r.Float64()*0.3 - 0.15) * typingDurationSec
			finalTypingSec := typingDurationSec + jitter
			if finalTypingSec < float64(minTyping) {
				finalTypingSec = float64(minTyping)
			}

			log.Printf("[Anti-Ban] Simulando digitação para %s por %.1f segundos (%d caracteres)...", cleanPhone, finalTypingSec, textLen)

			// Dispara evento de "Digitando..." no WhatsApp
			_ = client.SendChatPresence(context.Background(), recipientJID, types.ChatPresenceComposing, types.ChatPresenceMediaText)

			time.Sleep(time.Duration(finalTypingSec * float64(time.Second)))

			// Pausa digitação
			_ = client.SendChatPresence(context.Background(), recipientJID, types.ChatPresencePaused, types.ChatPresenceMediaText)

			// Pausa natural de 1 a 2 segundos antes de enviar
			naturalPause := time.Duration(1000+r.Intn(1000)) * time.Millisecond
			time.Sleep(naturalPause)

			// 2. Envia a mensagem (e comprovante se houver)
			var sendErr error
			var resp whatsmeow.SendResponse

			if nextItem.MediaURL != "" {
				mediaResp, err := http.Get(nextItem.MediaURL)
				if err == nil && mediaResp.StatusCode == http.StatusOK {
					defer mediaResp.Body.Close()
					fileBytes, err := io.ReadAll(mediaResp.Body)
					if err == nil && len(fileBytes) > 0 {
						contentType := mediaResp.Header.Get("Content-Type")

						if strings.HasPrefix(contentType, "image/") {
							uploadResp, err := client.Upload(context.Background(), fileBytes, whatsmeow.MediaImage)
							if err == nil {
								msg := &waE2E.Message{
									ImageMessage: &waE2E.ImageMessage{
										Caption:       proto.String(nextItem.Message),
										Mimetype:      proto.String(contentType),
										URL:           proto.String(uploadResp.URL),
										DirectPath:    proto.String(uploadResp.DirectPath),
										MediaKey:      uploadResp.MediaKey,
										FileEncSHA256: uploadResp.FileEncSHA256,
										FileSHA256:    uploadResp.FileSHA256,
										FileLength:    proto.Uint64(uint64(len(fileBytes))),
									},
								}
								resp, sendErr = client.SendMessage(context.Background(), recipientJID, msg)
							}
						} else {
							fileName := "comprovante_pagamento.pdf"
							uploadResp, err := client.Upload(context.Background(), fileBytes, whatsmeow.MediaDocument)
							if err == nil {
								msg := &waE2E.Message{
									DocumentMessage: &waE2E.DocumentMessage{
										Caption:       proto.String(nextItem.Message),
										Title:         proto.String(fileName),
										FileName:      proto.String(fileName),
										Mimetype:      proto.String(contentType),
										URL:           proto.String(uploadResp.URL),
										DirectPath:    proto.String(uploadResp.DirectPath),
										MediaKey:      uploadResp.MediaKey,
										FileEncSHA256: uploadResp.FileEncSHA256,
										FileSHA256:    uploadResp.FileSHA256,
										FileLength:    proto.Uint64(uint64(len(fileBytes))),
									},
								}
								resp, sendErr = client.SendMessage(context.Background(), recipientJID, msg)
							}
						}
					}
				}
			}

			// Se não houver mídia ou falhar envio de mídia, envia texto padrão
			if sendErr != nil || resp.ID == "" {
				textMsg := &waE2E.Message{
					Conversation: proto.String(nextItem.Message),
				}
				resp, sendErr = client.SendMessage(context.Background(), recipientJID, textMsg)
			}

			now := time.Now()
			queueMutex.Lock()
			if sendErr != nil {
				nextItem.Status = "failed"
				nextItem.Error = sendErr.Error()
				log.Printf("[Queue] Falha ao enviar para %s: %v", cleanPhone, sendErr)
			} else {
				nextItem.Status = "sent"
				nextItem.SentAt = &now
				log.Printf("[Queue] Mensagem enviada com sucesso para %s (ID: %s)", cleanPhone, resp.ID)

				// Atualiza contador diário
				configMutex.Lock()
				currentConfig.SentToday++
				saveConfigUnsafe()
				configMutex.Unlock()
			}
			queueMutex.Unlock()

			// 3. Espaçamento configurável entre mensagens para evitar bloqueio da Meta
			if maxDelay < minDelay {
				maxDelay = minDelay
			}
			delayRange := maxDelay - minDelay
			actualDelaySec := minDelay
			if delayRange > 0 {
				actualDelaySec += r.Intn(delayRange + 1)
			}

			log.Printf("[Anti-Ban] Aguardando espaçamento de segurança: %d segundos antes da próxima mensagem...", actualDelaySec)
			time.Sleep(time.Duration(actualDelaySec) * time.Second)
		}
	}()
}

func handleStatus(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	connected := client != nil && client.IsConnected()
	loggedIn := client != nil && client.IsLoggedIn()

	phone := ""
	pushName := ""
	status := "disconnected"

	if loggedIn && client.Store.ID != nil {
		phone = client.Store.ID.User
		pushName = client.Store.PushName
		if connected {
			status = "connected"
		} else {
			status = "reconnecting"
		}
	} else if client != nil && client.Store.ID == nil {
		qrCodeMutex.RLock()
		if currentQRCode != "" {
			status = "waiting_qr"
		}
		qrCodeMutex.RUnlock()
	}

	configMutex.RLock()
	sentToday := currentConfig.SentToday
	dailyLimit := currentConfig.DailyLimit
	configMutex.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"service_online": true,
		"connected":      connected && loggedIn,
		"logged_in":      loggedIn,
		"phone":          phone,
		"push_name":      pushName,
		"status":         status,
		"sent_today":     sentToday,
		"daily_limit":    dailyLimit,
	})
}

func handleQR(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if client == nil {
		http.Error(w, `{"success":false,"message":"Cliente não iniciado"}`, http.StatusInternalServerError)
		return
	}

	if client.IsConnected() && client.IsLoggedIn() {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success":   true,
			"status":    "connected",
			"connected": true,
		})
		return
	}

	qrCodeMutex.RLock()
	qrImg := currentQRImage
	qrRaw := currentQRCode
	qrCodeMutex.RUnlock()

	if qrImg == "" {
		_ = startPairing()
		for i := 0; i < 6; i++ {
			time.Sleep(500 * time.Millisecond)
			qrCodeMutex.RLock()
			qrImg = currentQRImage
			qrRaw = currentQRCode
			qrCodeMutex.RUnlock()
			if qrImg != "" {
				break
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"status":    "scan_qr",
		"connected": false,
		"qr_code":   qrImg,
		"raw_code":  qrRaw,
	})
}

func handleDisconnect(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if client != nil {
		if client.IsConnected() {
			_ = client.Logout(context.Background())
			client.Disconnect()
		}
	}
	setupNewDeviceAndClient()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "WhatsApp desconectado com sucesso",
	})
}

func handleSend(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, `{"success":false,"error":"Método não permitido"}`, http.StatusMethodNotAllowed)
		return
	}

	if client == nil || !client.IsConnected() || !client.IsLoggedIn() {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": false,
			"error":   "WhatsApp não está conectado. Conecte pelo QR Code na aba WhatsApp antes de enviar.",
		})
		return
	}

	var req struct {
		Phone         string `json:"phone"`
		Message       string `json:"message"`
		MediaURL      string `json:"media_url,omitempty"`
		SolicitacaoID string `json:"solicitacao_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"success":false,"error":"JSON inválido"}`, http.StatusBadRequest)
		return
	}

	cleanPhone := normalizePhone(req.Phone)

	if cleanPhone == "" || req.Message == "" {
		http.Error(w, `{"success":false,"error":"Telefone e mensagem são obrigatórios"}`, http.StatusBadRequest)
		return
	}

	// Adiciona à fila de envio
	queueID := fmt.Sprintf("msg_%d_%d", time.Now().Unix(), rand.Intn(1000))
	item := &QueueItem{
		ID:            queueID,
		Phone:         cleanPhone,
		Message:       req.Message,
		MediaURL:      req.MediaURL,
		SolicitacaoID: req.SolicitacaoID,
		Status:        "queued",
		CreatedAt:     time.Now(),
	}

	queueMutex.Lock()
	// Mantém no máximo 100 itens no histórico
	if len(activeQueue) > 100 {
		activeQueue = activeQueue[len(activeQueue)-80:]
	}
	activeQueue = append(activeQueue, item)
	queueLen := len(activeQueue)
	queueMutex.Unlock()

	// Notifica o worker
	select {
	case queueNotify <- struct{}{}:
	default:
	}

	log.Printf("[Queue] Mensagem adicionada à fila: %s para %s (Posição na fila: %d)", queueID, cleanPhone, queueLen)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":        true,
		"queued":         true,
		"queue_id":       queueID,
		"queue_position": queueLen,
		"message":        "Mensagem enfileirada com sucesso para entrega humanizada.",
	})
}

func handleConfig(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method == http.MethodPost {
		var newCfg AntiBanConfig
		if err := json.NewDecoder(r.Body).Decode(&newCfg); err != nil {
			http.Error(w, `{"success":false,"error":"JSON inválido"}`, http.StatusBadRequest)
			return
		}

		configMutex.Lock()
		if newCfg.DailyLimit > 0 {
			currentConfig.DailyLimit = newCfg.DailyLimit
		}
		if newCfg.MinDelaySec >= 5 {
			currentConfig.MinDelaySec = newCfg.MinDelaySec
		}
		if newCfg.MaxDelaySec >= currentConfig.MinDelaySec {
			currentConfig.MaxDelaySec = newCfg.MaxDelaySec
		}
		if newCfg.TypingSpeedMs >= 30 {
			currentConfig.TypingSpeedMs = newCfg.TypingSpeedMs
		}
		saveConfigUnsafe()
		resCfg := currentConfig
		configMutex.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"config":  resCfg,
			"message": "Configurações Anti-Ban salvas com sucesso.",
		})
		return
	}

	// GET
	checkResetDay()
	configMutex.RLock()
	cfg := currentConfig
	configMutex.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cfg)
}

func handleQueue(w http.ResponseWriter, r *http.Request) {
	enableCORS(w)
	if r.Method == http.MethodOptions {
		return
	}

	if r.Method == http.MethodPost {
		// Limpa itens pendentes da fila
		queueMutex.Lock()
		cleared := 0
		var remaining []*QueueItem
		for _, it := range activeQueue {
			if it.Status == "queued" {
				cleared++
			} else {
				remaining = append(remaining, it)
			}
		}
		activeQueue = remaining
		queueMutex.Unlock()

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"cleared": cleared,
			"message": fmt.Sprintf("%d mensagens pendentes foram removidas da fila.", cleared),
		})
		return
	}

	// GET: Retorna itens da fila (mais recentes primeiro)
	queueMutex.RLock()
	items := make([]*QueueItem, len(activeQueue))
	copy(items, activeQueue)
	queueMutex.RUnlock()

	// Inverte para exibir mais recentes no topo
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}

	configMutex.RLock()
	sentToday := currentConfig.SentToday
	dailyLimit := currentConfig.DailyLimit
	configMutex.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"items":       items,
		"sent_today":  sentToday,
		"daily_limit": dailyLimit,
	})
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "5001"
	}

	loadConfig()

	dbLog := waLog.Stdout("Database", "WARN", true)
	dbPath := filepath.Join(".", "whatsapp_session.db")
	dbDSN := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(10000)", dbPath)
	var err error
	container, err = sqlstore.New(context.Background(), "sqlite", dbDSN, dbLog)
	if err != nil {
		log.Fatalf("Erro ao abrir banco SQLite de sessão: %v", err)
	}

	deviceStore, err := container.GetFirstDevice(context.Background())
	if err != nil || deviceStore == nil {
		deviceStore = container.NewDevice()
	}

	clientLog = waLog.Stdout("Client", "INFO", true)
	client = whatsmeow.NewClient(deviceStore, clientLog)
	setupClientEvents()

	// Conecta sessão existente se houver
	if client.Store != nil && client.Store.ID != nil {
		log.Println("[WhatsApp] Sessão existente encontrada. Conectando...")
		err = client.Connect()
		if err != nil {
			log.Printf("[WhatsApp] Erro na conexão inicial: %v", err)
			if strings.Contains(err.Error(), "deleted device") || strings.Contains(err.Error(), "401") {
				setupNewDeviceAndClient()
			}
		}
	}

	// Inicia worker da fila anti-ban
	startQueueWorker()

	http.HandleFunc("/api/status", handleStatus)
	http.HandleFunc("/api/qr", handleQR)
	http.HandleFunc("/api/send", handleSend)
	http.HandleFunc("/api/config", handleConfig)
	http.HandleFunc("/api/queue", handleQueue)
	http.HandleFunc("/api/disconnect", handleDisconnect)

	server := &http.Server{
		Addr: ":" + port,
	}

	go func() {
		log.Printf("[WhatsApp Service] Servidor Whatsmeow Go com Anti-Ban e Fila iniciado na porta %s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Erro no servidor HTTP: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	log.Println("[WhatsApp Service] Desligando servidor...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if client != nil && client.IsConnected() {
		client.Disconnect()
	}
	_ = server.Shutdown(ctx)
	log.Println("[WhatsApp Service] Finalizado.")
}
