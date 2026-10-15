package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/middlewares"
	"onperfumaria/backend/internal/services"
	"onperfumaria/backend/internal/shipping"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// NewRouter monta o motor gin com todas as rotas da API e o front-end
// estatico, alem dos middlewares globais (CORS). E chamada uma unica vez na
// subida do servidor.
func NewRouter(cfg config.Config, db *pgxpool.Pool) *gin.Engine {
	router := gin.Default()
	router.Use(cors(cfg.FrontendURL))
	// service concentra toda a regra de negocio (pedidos, clientes, frete,
	// etc.); os handlers abaixo so traduzem HTTP <-> chamadas nesse service.
	service := services.NewService(cfg, db)

	// Checagem simples de "esta no ar", usada por monitoramento/deploy.
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Rotas publicas da loja: o grupo /api reune tanto endpoints abertos
	// (catalogo, frete, checkout) quanto rotas administrativas que exigem
	// RequireAdmin - a separacao por grupo e so de prefixo, a autenticacao
	// e feita rota a rota.
	api := router.Group("/api")
	{
		// Devolve o catalogo completo montado pelo Organizador (admin).
		api.GET("/organizer", func(c *gin.Context) {
			data, err := service.GetOrganizerStore(c.Request.Context())
			respond(c, data, err)
		})
		// Sobrescreve o catalogo inteiro de uma vez; so admin pode publicar.
		api.PUT("/organizer", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			var input json.RawMessage
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveOrganizerStore(c.Request.Context(), input)
			respond(c, data, err)
		})
		// Registra eventos de navegacao (visualizacao/clique) por produto,
		// usados nas metricas do admin; aceita cliente anonimo ou logado.
		api.POST("/store/events", func(c *gin.Context) {
			var input struct {
				ProductID string `json:"productId"`
				Type      string `json:"type"`
				SessionID string `json:"sessionId"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			err := service.RecordProductEvent(c.Request.Context(), optionalCustomerID(cfg, c), input.SessionID, input.ProductID, input.Type)
			respond(c, true, err)
		})
		// Configuracao publica da loja (banners, destaques, etc.) usada pelo
		// front-end ao montar a home.
		api.GET("/store/config", func(c *gin.Context) {
			data, err := service.StoreConfig(c.Request.Context())
			respond(c, data, err)
		})
		// Cotacao de frete usada no carrinho/checkout antes de fechar pedido.
		api.POST("/shipping/quote", func(c *gin.Context) {
			var input shipping.QuoteInput
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.QuoteShipping(c.Request.Context(), input)
			respond(c, data, err)
		})
		// Valida um cupom digitado no carrinho e devolve o desconto aplicavel
		// aquele subtotal.
		api.POST("/store/validate-coupon", func(c *gin.Context) {
			var input struct {
				Code     string  `json:"code"`
				Subtotal float64 `json:"subtotal"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.ValidateCoupon(c.Request.Context(), input.Code, input.Subtotal)
			respond(c, data, err)
		})
		// Consulta direta as opcoes dos Correios (SEDEX/PAC) a partir de um
		// CEP de destino; CEP de origem fixo e o da loja.
		api.GET("/shipping/correios", func(c *gin.Context) {
			cep := c.Query("cep")
			weightGrams, _ := strconv.Atoi(c.DefaultQuery("weight", "0"))
			data, err := shipping.FetchCorreiosOptions("79000000", cep, weightGrams)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}
			respond(c, data, nil)
		})
		// Fecha o pedido: le o cliente (se logado) do token opcional e o
		// dominio publico da requisicao, que o Mercado Pago vai usar para
		// avisar quando o pagamento for aprovado.
		api.POST("/checkout", func(c *gin.Context) {
			var input services.CheckoutInput
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			input.CustomerID = customerIDFromHeader(cfg, c)
			input.PublicBaseURL = publicBaseURL(c)
			data, err := service.CreateOrder(c.Request.Context(), input)
			respond(c, data, err)
		})
		// Consulta publica de um pedido pelo id (pagina de acompanhamento).
		api.GET("/order/:id", func(c *gin.Context) {
			data, err := service.GetOrderPublic(c.Request.Context(), c.Param("id"))
			respond(c, data, err)
		})
		// Lista de pedidos do admin, com paginacao e filtros (busca, status,
		// forma de pagamento, intervalo de datas).
		api.GET("/orders", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
			limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
			filter := services.OrderFilter{
				Search:    c.Query("search"),
				Status:    c.Query("status"),
				Payment:   c.Query("payment"),
				StartDate: c.Query("startDate"),
				EndDate:   c.Query("endDate"),
				Page:      page,
				Limit:     limit,
			}
			data, err := service.Orders(c.Request.Context(), filter)
			respond(c, data, err)
		})
		// Lista de clientes do admin, com busca por nome/e-mail/CPF.
		api.GET("/customers", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			data, err := service.Customers(c.Request.Context(), c.Query("search"), c.GetString("userID"))
			respond(c, data, err)
		})
		// Ficha detalhada de um cliente, vista pelo admin.
		api.GET("/customers/:id", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			data, err := service.CustomerProfile(c.Request.Context(), c.Param("id"), c.GetString("userID"))
			respond(c, data, err)
		})
		// A gaveta "API" guarda tokens e chaves sensiveis (Mercado Pago, Google) e
		// so o administrador fixo da loja pode ver ou editar - mesmo outro admin
		// promovido em Contas recebe 403 aqui.
		api.GET("/admin/api-settings", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			isFixedAdmin, err := service.IsFixedAdmin(c.Request.Context(), c.GetString("userID"))
			if err != nil || !isFixedAdmin {
				c.JSON(http.StatusForbidden, gin.H{"message": "acesso restrito ao administrador fixo"})
				return
			}
			data, err := service.GetAPISettings(c.Request.Context())
			respond(c, data, err)
		})
		api.PUT("/admin/api-settings", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			isFixedAdmin, err := service.IsFixedAdmin(c.Request.Context(), c.GetString("userID"))
			if err != nil || !isFixedAdmin {
				c.JSON(http.StatusForbidden, gin.H{"message": "acesso restrito ao administrador fixo"})
				return
			}
			var input struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			// So essas chaves podem ser gravadas por aqui - evita que a rota
			// vire uma gaveta generica de configuracao arbitraria.
			allowedKeys := map[string]bool{
				"mp_access_token": true, "mp_public_key": true, "mp_webhook_secret": true, "google_client_id": true,
			}
			if !allowedKeys[input.Key] {
				c.JSON(http.StatusBadRequest, gin.H{"message": "chave de configuracao invalida"})
				return
			}
			err = service.SaveSetting(c.Request.Context(), input.Key, input.Value)
			respond(c, gin.H{"success": true}, err)
		})
		// Numero de WhatsApp da loja: diferente da gaveta "API" acima, nao e
		// sensivel, entao qualquer admin (nao so o fixo) pode ver e editar.
		api.GET("/admin/store-whatsapp", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			// Chave pode nunca ter sido salva ainda - "sem linha" so significa
			// "numero vazio", nao um erro (mesma convencao de StoreConfig/GetAPISettings).
			value, _ := service.GetSetting(c.Request.Context(), "store_whatsapp")
			respond(c, gin.H{"value": value}, nil)
		})
		api.PUT("/admin/store-whatsapp", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			var input struct {
				Value string `json:"value"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			err := service.SaveSetting(c.Request.Context(), "store_whatsapp", input.Value)
			respond(c, gin.H{"success": true}, err)
		})
		// Painel de aparencia (cores, fontes, logo, formato de botao/janela,
		// densidade): assim como store-whatsapp acima, nao e dado sensivel,
		// entao qualquer admin (nao so o fixo) pode ver e editar.
		api.GET("/admin/theme-settings", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			data, err := service.GetThemeSettings(c.Request.Context())
			respond(c, data, err)
		})
		api.PUT("/admin/theme-settings", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			var input struct {
				Key   string `json:"key"`
				Value string `json:"value"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			err := service.SaveThemeSetting(c.Request.Context(), input.Key, input.Value)
			respond(c, gin.H{"success": true}, err)
		})
		// Gaveta de notificacoes do admin: pedidos recentes com contador de
		// nao lidos, perto dos botoes Editor/Sair no topo da loja.
		api.GET("/admin/notifications", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			limit, _ := strconv.Atoi(c.DefaultQuery("limit", "30"))
			data, err := service.AdminOrderNotifications(c.Request.Context(), limit)
			respond(c, data, err)
		})
		// So o contador, para o badge no sino de notificacoes (evita trazer a
		// lista inteira so para desenhar o numero).
		api.GET("/admin/notifications/unread-count", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			count, err := service.AdminUnreadOrderCount(c.Request.Context())
			respond(c, gin.H{"unread": count}, err)
		})
		// Marca uma notificacao como lida e devolve o detalhe do pedido junto,
		// para abrir o modal sem uma segunda chamada.
		api.POST("/admin/notifications/:id/read", middlewares.RequireAdmin(cfg), func(c *gin.Context) {
			detail, err := service.AdminOrderNotificationDetail(c.Request.Context(), c.Param("id"))
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"message": err.Error()})
				return
			}
			unread, err := service.MarkOrderNotificationRead(c.Request.Context(), c.Param("id"))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}
			detail["unread"] = unread
			respond(c, detail, nil)
		})
		// So quem ja e admin pode promover outro cliente. A unica excecao e a
		// loja recem-instalada (nenhum admin ainda): nesse caso a rota libera
		// uma vez sem token para destravar o primeiro acesso.
		api.PUT("/customers/:id/admin", func(c *gin.Context) {
			var input struct {
				IsAdmin bool `json:"isAdmin"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}

			adminCount, err := service.CountAdmins(c.Request.Context())
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
				return
			}

			if adminCount > 0 {
				header := c.GetHeader("Authorization")
				claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
				if !strings.HasPrefix(header, "Bearer ") || err != nil || claims.Scope != "customer" || claims.Role != "admin" {
					c.JSON(http.StatusForbidden, gin.H{"message": "acesso restrito a administradores"})
					return
				}
			}

			data, err := service.SetCustomerAdmin(c.Request.Context(), c.Param("id"), input.IsAdmin)
			respond(c, data, err)
		})
		// Enviar e-mail custa caro e e uma via de abuso, entao a janela aqui e
		// bem mais curta que a das outras rotas.
		api.POST("/auth/customer/recover", middlewares.RateLimit("recover", 5, 15*time.Minute), func(c *gin.Context) {
			var input struct {
				Identifier string `json:"identifier"`
				Email      string `json:"email"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			identifier := input.Identifier
			if identifier == "" {
				identifier = input.Email
			}
			// A resposta e sempre a mesma, com ou sem cadastro: o token sai por
			// e-mail e nunca pelo corpo da resposta.
			err := service.RequestPasswordReset(c.Request.Context(), identifier)
			respond(c, gin.H{"sent": true}, err)
		})
		// Etapa 2 da recuperacao: troca o token recebido por e-mail por uma
		// senha nova.
		api.POST("/auth/customer/reset", middlewares.RateLimit("reset", 10, time.Minute), func(c *gin.Context) {
			var input struct {
				Token    string `json:"token"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.ResetPassword(c.Request.Context(), input.Token, input.Password)
			respond(c, data, err)
		})
		// Proxy simples para a API publica do ViaCEP, usado para autocompletar
		// endereco a partir do CEP digitado no checkout/cadastro.
		api.GET("/cep/:cep", func(c *gin.Context) {
			cep := strings.ReplaceAll(c.Param("cep"), "-", "")
			resp, err := http.Get("https://viacep.com.br/ws/" + cep + "/json/")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "erro ao consultar CEP"})
				return
			}
			defer resp.Body.Close()
			var result map[string]interface{}
			_ = json.NewDecoder(resp.Body).Decode(&result)
			respond(c, result, nil)
		})
		// Etapa 1 do login: descobre se o e-mail/CPF digitado tem cadastro e
		// como essa conta entra (senha, Google ou os dois).
		api.POST("/auth/customer/identify", middlewares.RateLimit("identify", 20, time.Minute), func(c *gin.Context) {
			var input struct {
				Identifier string `json:"identifier"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.IdentifyCustomer(c.Request.Context(), input.Identifier)
			respond(c, data, err)
		})
		// Checagem em tempo real da ficha: diz quais campos ja existem no banco.
		api.POST("/auth/customer/availability", middlewares.RateLimit("availability", 30, time.Minute), func(c *gin.Context) {
			var input struct {
				Email string `json:"email"`
				CPF   string `json:"cpf"`
				Phone string `json:"phone"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.CustomerFieldConflicts(c.Request.Context(), input.Email, input.CPF, input.Phone, customerIDFromHeader(cfg, c))
			respond(c, gin.H{"conflicts": data}, err)
		})
		// Login/cadastro via credencial do Google One Tap/Sign-In.
		api.POST("/auth/customer/google", middlewares.RateLimit("google", 10, time.Minute), func(c *gin.Context) {
			var input struct {
				Credential string `json:"credential"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.GoogleSignIn(c.Request.Context(), input.Credential)
			respond(c, data, err)
		})
		api.POST("/auth/customer/register", middlewares.RateLimit("register", 5, 10*time.Minute), func(c *gin.Context) {
			var input services.CustomerRegistrationPayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			// Com token, a mesma ficha completa o cadastro de quem entrou pelo
			// Google e chegou aqui com telefone/CPF/endereco em branco.
			data, err := service.RegisterCustomer(c.Request.Context(), customerIDFromHeader(cfg, c), input)
			respond(c, data, err)
		})
		// Etapa 2 do login: confirma a senha para o identificador validado em
		// /identify.
		api.POST("/auth/customer/login", middlewares.RateLimit("login", 10, time.Minute), func(c *gin.Context) {
			var input struct {
				Identifier string `json:"identifier"`
				Email      string `json:"email"`
				Password   string `json:"password"`
			}
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			identifier := input.Identifier
			if identifier == "" {
				identifier = input.Email
			}
			token, err := service.CustomerLoginIdentifier(c.Request.Context(), identifier, input.Password)
			respond(c, gin.H{"token": token}, err)
		})
	}

	// Rotas autenticadas do cliente: exigem token JWT de escopo "customer"
	// (middlewares.JWT), diferente das rotas de admin acima que exigem role
	// "admin" dentro desse mesmo escopo.
	customer := api.Group("/customer")
	customer.Use(middlewares.JWT(cfg, "customer"))
	{
		// Perfil do proprio cliente logado (dados usados na area "Minha conta").
		customer.GET("/me", func(c *gin.Context) {
			userID := c.GetString("userID")
			data, err := service.CustomerProfile(c.Request.Context(), userID, userID)
			respond(c, data, err)
		})
		// Detalhe de um pedido do proprio cliente (confere o dono antes de
		// devolver, dentro do service).
		customer.GET("/orders/:id", func(c *gin.Context) {
			data, err := service.CustomerOrder(c.Request.Context(), c.GetString("userID"), c.Param("id"))
			respond(c, data, err)
		})
		// Atualiza dados cadastrais do cliente logado.
		customer.PUT("/me", func(c *gin.Context) {
			var input services.CustomerProfilePayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.UpdateCustomerProfile(c.Request.Context(), c.GetString("userID"), input)
			respond(c, data, err)
		})
		// Adiciona um novo endereco de entrega a agenda do cliente.
		customer.POST("/addresses", func(c *gin.Context) {
			var input services.CustomerAddressPayload
			if err := c.ShouldBindJSON(&input); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
				return
			}
			data, err := service.SaveCustomerAddress(c.Request.Context(), c.GetString("userID"), input)
			respond(c, data, err)
		})
		// Define qual endereco salvo e o padrao, usado para pre-preencher o
		// checkout.
		customer.PUT("/addresses/:id/default", func(c *gin.Context) {
			data, err := service.SetDefaultCustomerAddress(c.Request.Context(), c.GetString("userID"), c.Param("id"))
			respond(c, data, err)
		})
	}

	// Serve os uploads (imagens de produto, etc.) enviados pelo admin, e
	// registra as rotas que entregam o front-end buildado (SPA).
	router.Static("/uploads", filepath.Join("public", "uploads"))
	registerFrontend(router)

	// Webhook do Mercado Pago: notificacao assincrona de mudanca de status de
	// pagamento (ex.: Pix pago). Fica fora do grupo /api/... de proposito, no
	// nivel do router, pois nao precisa (nem deve) passar pelos middlewares
	// de autenticacao das rotas de cliente/admin.
	router.POST("/api/webhooks/mercadopago", func(c *gin.Context) {
		var input struct {
			Action string `json:"action"`
			Type   string `json:"type"`
			Topic  string `json:"topic"`
			Data   struct {
				// json.Number aceita tanto "123" quanto 123: o Mercado Pago
				// manda o id como texto no webhook e como numero em parte das
				// notificacoes antigas.
				ID json.Number `json:"id"`
			} `json:"data"`
		}
		_ = c.ShouldBindJSON(&input)

		// O Mercado Pago avisa em dois formatos, conforme a integracao: o
		// webhook atual usa ?type=payment&data.id=123 (e repete isso no corpo)
		// e o IPN antigo usa ?topic=payment&id=123. Ler so "topic"/"id" fazia o
		// aviso de pagamento aprovado ser descartado em silencio - o cliente
		// pagava o Pix e o pedido ficava em "aguardando pagamento" para sempre.
		topic := firstNonEmpty(c.Query("type"), c.Query("topic"), input.Type, input.Topic)
		paymentID := firstNonEmpty(c.Query("data.id"), c.Query("id"), input.Data.ID.String())
		if paymentID == "" {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
			return
		}

		// Confere a assinatura HMAC enviada pelo Mercado Pago antes de confiar
		// no aviso - sem isso, qualquer um poderia forjar "pagamento aprovado"
		// so chamando essa URL.
		if err := service.VerifyMPWebhookSignature(
			c.Request.Context(), c.GetHeader("x-signature"), c.GetHeader("x-request-id"), paymentID,
		); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
			return
		}

		// Aplica a mudanca de status do pagamento no pedido correspondente.
		if err := service.HandleMPWebhook(c.Request.Context(), topic, paymentID); err != nil {
			// 500 de proposito: o Mercado Pago repete a notificacao quando nao
			// recebe 2xx, entao uma falha passageira (banco fora do ar, por
			// exemplo) ainda tem como ser recuperada na proxima tentativa.
			c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	return router
}

// registerFrontend serve o build estatico do front-end (SPA) quando ele
// existe em public/; em desenvolvimento, sem o build, a funcao simplesmente
// nao registra nada e o front-end roda separado (Vite dev server).
func registerFrontend(router *gin.Engine) {
	publicDir := "public"
	indexPath := filepath.Join(publicDir, "index.html")
	// Sem index.html nao ha o que servir - ambiente de dev tipicamente.
	if _, err := os.Stat(indexPath); err != nil {
		return
	}

	// Os arquivos em /assets têm hash no nome (ex: index-AbC123.js) e mudam a
	// cada build, então podem ser cacheados para sempre. Já o index.html
	// referencia esses hashes e é sobrescrito a cada deploy: sem
	// no-cache aqui, o navegador podia guardar uma versão antiga da página
	// apontando para arquivos que o deploy seguinte já apagou.
	router.Use(func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/assets/") {
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		}
		c.Next()
	})

	// serveIndex entrega sempre a pagina principal da SPA, sem cache, para o
	// roteamento do lado do cliente (React Router) assumir a partir dai.
	serveIndex := func(c *gin.Context) {
		c.Header("Cache-Control", "no-store")
		c.File(indexPath)
	}

	router.Static("/assets", filepath.Join(publicDir, "assets"))
	router.GET("/", serveIndex)
	// Qualquer caminho desconhecido que nao seja GET nem rota de API/health
	// cai aqui: devolve a SPA (ela decide se e uma pagina valida ou um 404
	// interno), e so responde 404 de verdade para API/health ou metodos
	// diferentes de GET.
	router.NoRoute(func(c *gin.Context) {
		if c.Request.Method != http.MethodGet || strings.HasPrefix(c.Request.URL.Path, "/api") || c.Request.URL.Path == "/health" {
			c.JSON(http.StatusNotFound, gin.H{"message": "not found"})
			return
		}
		serveIndex(c)
	})
}

// customerIDFromHeader le o token opcional de rotas publicas que mudam de
// comportamento quando o cliente ja esta logado. Devolve "" para visitantes.
func customerIDFromHeader(cfg config.Config, c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
	if err != nil || claims.Scope != "customer" {
		return ""
	}
	return claims.UserID
}
