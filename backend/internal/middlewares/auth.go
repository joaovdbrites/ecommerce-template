package middlewares

import (
	"net/http"
	"strings"

	"onperfumaria/backend/internal/auth"
	"onperfumaria/backend/internal/config"

	"github.com/gin-gonic/gin"
)

func JWT(cfg config.Config, scope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "missing token"})
			c.Abort()
			return
		}

		claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
		if err != nil || claims.Scope != scope {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid token"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// RequireAdmin exige um token de cliente valido cuja claim role seja "admin".
// Usada nas rotas do Admin (ex-Organizador) e nas que listam dados de clientes,
// que antes ficavam completamente abertas.
func RequireAdmin(cfg config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "missing token"})
			c.Abort()
			return
		}

		claims, err := auth.ParseToken(cfg.JWTSecret, strings.TrimPrefix(header, "Bearer "))
		if err != nil || claims.Scope != "customer" || claims.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"message": "acesso restrito a administradores"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}
