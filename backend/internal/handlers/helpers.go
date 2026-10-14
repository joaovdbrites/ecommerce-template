package handlers

import (
	"errors"
	"net/http"
	"strings"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/config"
	"onperfumaria/backend/internal/services"

	"github.com/gin-gonic/gin"
)

// publicBaseURL monta o endereco publico pelo qual a loja esta sendo acessada
// agora (ex.: "https://onperfumaria.com"), lendo os cabecalhos que o proxy do
// servidor preenche. Serve para dizer ao Mercado Pago onde avisar que o
// pagamento foi aprovado: o backend tambem entrega o site, entao o dominio do
// pedido e, por definicao, um endereco que responde - diferente da variavel
// FRONTEND_URL, que fica desatualizada em silencio quando a loja troca de
// dominio e so se descobre quando algum aviso para de chegar. Devolve "" fora
// de https, para o caso local continuar usando a configuracao.
func publicBaseURL(c *gin.Context) string {
	// Com varios proxies encadeados os cabecalhos viram "valor1, valor2".
	firstValue := func(value string) string {
		if first, _, found := strings.Cut(value, ","); found {
			return strings.TrimSpace(first)
		}
		return strings.TrimSpace(value)
	}

	host := firstValue(firstNonEmpty(c.GetHeader("X-Forwarded-Host"), c.Request.Host))
	if !isPublicHost(host) {
		return ""
	}

	scheme := firstValue(c.GetHeader("X-Forwarded-Proto"))
	if scheme == "" && c.Request.TLS != nil {
		scheme = "https"
	}
	if scheme == "" {
		// Nem todo proxy preenche o cabecalho de protocolo. Chegando num
		// dominio publico, https e a unica forma de a loja estar no ar - e o
		// Mercado Pago so aceita aviso por https de qualquer jeito.
		scheme = "https"
	}
	if scheme != "https" {
		return ""
	}
	return scheme + "://" + host
}

// isPublicHost separa o dominio real da loja dos enderecos de
// desenvolvimento/rede interna, que nao servem como endereco de aviso.
func isPublicHost(host string) bool {
	name := host
	if trimmed, _, found := strings.Cut(name, ":"); found {
		name = trimmed
	}
	name = strings.Trim(name, "[]")
	switch name {
	case "", "localhost", "127.0.0.1", "::1":
		return false
	}
	// Nome de servico dentro do Docker ("backend", "app") nao tem ponto.
	return strings.Contains(name, ".")
}

// firstNonEmpty devolve o primeiro valor preenchido da lista - util para ler um
// mesmo dado que pode chegar por caminhos diferentes (query, corpo, cabecalho).
func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

// optionalCustomerID le o token "Bearer" quando presente, sem exigir login:
// usada em rotas publicas que personalizam a resposta so quando ha cliente
// autenticado (ex.: eventos de produto, carrosseis da home).
func optionalCustomerID(cfg config.Config, c *gin.Context) string {
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

func respond(c *gin.Context, data interface{}, err error) {
	if err != nil {
		if errors.Is(err, services.ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
			return
		}
		// A ficha de cadastro precisa saber qual campo reprovou para destacar o
		// input certo em vez de mostrar um erro generico no topo do formulario.
		var conflict *services.FieldConflictError
		if errors.As(err, &conflict) {
			c.JSON(http.StatusConflict, gin.H{"message": conflict.Message, "field": conflict.Field})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func cors(frontendURL string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if frontendURL != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", frontendURL)
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
