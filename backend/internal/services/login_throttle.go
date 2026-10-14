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

type loginAttempt struct {
	failures    int
	lockedUntil time.Time
	lastSeen    time.Time
}

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

func recordLoginFailure(key string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()

	entry := loginAttempts[key]
	now := time.Now()
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
