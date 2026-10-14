package handlers

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestPublicBaseURL(t *testing.T) {
	cases := []struct {
		name    string
		host    string
		headers map[string]string
		want    string
	}{
		{
			name:    "atras do proxy do servidor",
			host:    "onperfumaria.com",
			headers: map[string]string{"X-Forwarded-Proto": "https"},
			want:    "https://onperfumaria.com",
		},
		{
			name: "proxy informando outro host",
			host: "interno:8080",
			headers: map[string]string{
				"X-Forwarded-Proto": "https",
				"X-Forwarded-Host":  "onperfumaria.com",
			},
			want: "https://onperfumaria.com",
		},
		{
			name: "varios proxies encadeados usam o primeiro host",
			host: "interno:8080",
			headers: map[string]string{
				"X-Forwarded-Proto": "https",
				"X-Forwarded-Host":  "onperfumaria.com, interno:8080",
			},
			want: "https://onperfumaria.com",
		},
		{
			name:    "proxy que nao informa o protocolo ainda vale para dominio publico",
			host:    "onperfumaria.com",
			headers: map[string]string{},
			want:    "https://onperfumaria.com",
		},
		{
			name:    "localhost cai na configuracao do servidor",
			host:    "localhost:8080",
			headers: map[string]string{},
			want:    "",
		},
		{
			name:    "nome de servico interno do docker nao serve de endereco",
			host:    "backend:8080",
			headers: map[string]string{"X-Forwarded-Proto": "https"},
			want:    "",
		},
		{
			name:    "proxy declarando http cai na configuracao",
			host:    "onperfumaria.com",
			headers: map[string]string{"X-Forwarded-Proto": "http"},
			want:    "",
		},
	}

	gin.SetMode(gin.TestMode)
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest("POST", "/api/checkout", nil)
			request.Host = test.host
			for key, value := range test.headers {
				request.Header.Set(key, value)
			}
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = request

			if got := publicBaseURL(c); got != test.want {
				t.Errorf("publicBaseURL() = %q, esperado %q", got, test.want)
			}
		})
	}
}
