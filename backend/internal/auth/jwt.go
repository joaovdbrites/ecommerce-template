package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims sao os dados customizados guardados dentro do token JWT, alem dos
// campos padrao de expiracao/emissao vindos de jwt.RegisteredClaims.
type Claims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	Scope  string `json:"scope"`
	jwt.RegisteredClaims
}

// GenerateToken cria e assina um JWT HS256 com os dados do usuario, valido
// pelo periodo informado em duration a partir de agora.
func GenerateToken(secret, userID, role, scope string, duration time.Duration) (string, error) {
	claims := Claims{
		UserID: userID,
		Role:   role,
		Scope:  scope,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(duration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
}

// ParseToken valida a assinatura e a expiracao do token e devolve as claims
// nele contidas, se ele for valido.
func ParseToken(secret, token string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(token, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	// Confere que o tipo das claims e o nosso mesmo e que o token passou por
	// todas as validacoes da biblioteca (assinatura, expiracao etc.).
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, jwt.ErrTokenInvalidClaims
	}

	return claims, nil
}
