package services

import (
	"sync"
	"time"
)

// Freio por conta, complementar ao limite por IP do middleware: segura o
// ataque de forca bruta que troca de IP mas insiste no mesmo cadastro.
const (
	maxLoginFailures = 5
	loginLockWindow  = 15 * time.Minute
)

// loginAttempt acompanha o estado de tentativas de login de uma chave
// (tipicamente email/identificador da conta).
type loginAttempt struct {
	failures    int
	lockedUntil time.Time
	lastSeen    time.Time
}

// Estado em memoria do freio de login: protegido por mutex porque e
// acessado por goroutines concorrentes de requisicoes HTTP diferentes.
var (
	loginAttemptsMu sync.Mutex
	loginAttempts   = map[string]*loginAttempt{}
)

// loginLockRemaining devolve quanto falta do bloqueio, ou 0 se esta liberado.
func loginLockRemaining(key string) time.Duration {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()

	pruneLoginAttempts()
	entry := loginAttempts[key]
	if entry == nil {
		return 0
	}
	if remaining := time.Until(entry.lockedUntil); remaining > 0 {
		return remaining
	}
	return 0
}

// recordLoginFailure soma mais uma falha de login para a chave. Se a janela
// anterior ja expirou, comeca a contagem do zero; ao atingir o limite,
// tranca a chave por loginLockWindow e zera o contador de falhas.
func recordLoginFailure(key string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()

	entry := loginAttempts[key]
	now := time.Now()
	// Sem registro anterior, ou janela de contagem ja expirada: comeca
	// uma entrada nova em vez de herdar falhas antigas.
	if entry == nil || now.Sub(entry.lastSeen) > loginLockWindow {
		entry = &loginAttempt{}
		loginAttempts[key] = entry
	}
	entry.failures++
	entry.lastSeen = now
	if entry.failures >= maxLoginFailures {
		entry.lockedUntil = now.Add(loginLockWindow)
		entry.failures = 0
	}
}

// clearLoginAttempts apaga o historico de falhas da chave (chamado apos um
// login bem-sucedido, para nao carregar falhas antigas para a proxima vez).
func clearLoginAttempts(key string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	delete(loginAttempts, key)
}

// pruneLoginAttempts roda junto com a leitura para o mapa nao crescer sem fim.
// Quem chama ja segura o mutex.
func pruneLoginAttempts() {
	cutoff := time.Now().Add(-2 * loginLockWindow)
	for key, entry := range loginAttempts {
		if entry.lastSeen.Before(cutoff) && entry.lockedUntil.Before(time.Now()) {
			delete(loginAttempts, key)
		}
	}
}
