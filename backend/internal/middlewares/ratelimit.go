package middlewares

import (
	"fmt"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimit segura rajadas por IP numa janela deslizante simples, em memoria.
// As rotas de autenticacao respondem se um e-mail/CPF/telefone existe, entao
// sem isso da para varrer a base inteira a partir de uma lista de contatos.
//
// Memoria so: com mais de uma instancia da API cada uma conta o seu proprio
// balde, e um restart zera a contagem.
func RateLimit(name string, limit int, window time.Duration) gin.HandlerFunc {
	var (
		mu      sync.Mutex
		hits    = map[string][]time.Time{}
		lastGC  time.Time
		gcEvery = window
	)

	return func(c *gin.Context) {
		key := name + "|" + c.ClientIP()
		now := time.Now()
		cutoff := now.Add(-window)

		mu.Lock()
		if now.Sub(lastGC) > gcEvery {
			for storedKey, times := range hits {
				if len(times) == 0 || times[len(times)-1].Before(cutoff) {
					delete(hits, storedKey)
				}
			}
			lastGC = now
		}

		kept := hits[key][:0]
		for _, at := range hits[key] {
			if at.After(cutoff) {
				kept = append(kept, at)
			}
		}

		if len(kept) >= limit {
			retryAfter := int(math.Ceil((window - now.Sub(kept[0])).Seconds()))
			if retryAfter < 1 {
				retryAfter = 1
			}
			hits[key] = kept
			mu.Unlock()

			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"message": fmt.Sprintf("Muitas tentativas seguidas. Tente de novo em %s.", humanizeSeconds(retryAfter)),
			})
			return
		}

		hits[key] = append(kept, now)
		mu.Unlock()

		c.Next()
	}
}

func humanizeSeconds(seconds int) string {
	if seconds < 60 {
		return fmt.Sprintf("%d segundos", seconds)
	}
	minutes := int(math.Ceil(float64(seconds) / 60))
	if minutes == 1 {
		return "1 minuto"
	}
	return fmt.Sprintf("%d minutos", minutes)
}
