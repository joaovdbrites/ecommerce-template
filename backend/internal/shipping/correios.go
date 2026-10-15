package shipping

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// CorreiosOption e uma opcao de frete (SEDEX ou PAC) ja traduzida para o
// formato que o front-end exibe no carrinho/checkout.
type CorreiosOption struct {
	Service string
	Code    string
	Price   float64
	Days    int
	Label   string
}

// correiosResponse mapeia o envelope SOAP/XML devolvido pelo webservice
// publico dos Correios - so os campos usados pela loja sao declarados.
type correiosResponse struct {
	XMLName xml.Name `xml:"Envelope"`
	Body    struct {
		CalcPrecoPrazoResponse struct {
			Servicos struct {
				CServico []struct {
					Codigo       int    `xml:"Codigo"`
					Valor        string `xml:"Valor"`
					PrazoEntrega int    `xml:"PrazoEntrega"`
					Erro         int    `xml:"Erro"`
					MsgErro      string `xml:"MsgErro"`
				} `xml:"cServico"`
			} `xml:"CalcPrecoPrazoResult>Servicos"`
		} `xml:"CalcPrecoPrazoResponse"`
	}
}

// FetchCorreiosOptions consulta o webservice de calculo de preco/prazo dos
// Correios para SEDEX e PAC e devolve as opcoes validas para aquele CEP de
// destino e peso. cepOrigem e sempre o CEP da loja.
func FetchCorreiosOptions(cepOrigem, cepDestino string, weightGrams int) ([]CorreiosOption, error) {
	// Os Correios aceitam o CEP so com digitos, sem o traco que o usuario
	// costuma digitar.
	cepDestino = strings.ReplaceAll(cepDestino, "-", "")
	cepOrigem = strings.ReplaceAll(cepOrigem, "-", "")

	if len(cepDestino) != 8 || len(cepOrigem) != 8 {
		return nil, fmt.Errorf("CEP invalido")
	}

	// Peso minimo de 300g cobrado pelos Correios, mesmo para produtos mais
	// leves (ex.: uma amostra de perfume).
	weight := float64(weightGrams) / 1000.0
	if weight < 0.3 {
		weight = 0.3
	}

	// Os dois servicos cotados pela loja, com os codigos de servico do
	// webservice dos Correios.
	configs := []struct {
		code    string
		service string
	}{
		{"04014", "SEDEX"},
		{"04510", "PAC"},
	}

	options := []CorreiosOption{}

	// Uma chamada SOAP por servico - o webservice dos Correios nao cota os
	// dois de uma vez so.
	for _, cfg := range configs {
		soapBody := fmt.Sprintf(`<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CalcPrecoPrazo xmlns="http://tempuri.org/">
      <nCdEmpresa></nCdEmpresa>
      <sDsSenha></sDsSenha>
      <nCdServico>%s</nCdServico>
      <sCepOrigem>%s</sCepOrigem>
      <sCepDestino>%s</sCepDestino>
      <nVlPeso>%.1f</nVlPeso>
      <nCdFormato>1</nCdFormato>
      <nVlComprimento>18</nVlComprimento>
      <nVlAltura>12</nVlAltura>
      <nVlLargura>14</nVlLargura>
      <nVlDiametro>0</nVlDiametro>
      <sCdMaoPropria>N</sCdMaoPropria>
      <nVlValorDeclarado>0</nVlValorDeclarado>
      <sCdAvisoRecebimento>N</sCdAvisoRecebimento>
    </CalcPrecoPrazo>
  </soap:Body>
</soap:Envelope>`, cfg.code, cepOrigem, cepDestino, weight)

		req, err := http.NewRequest("POST", "http://ws.correios.com.br/calculador/CalcPrecoPrazo.asmx", strings.NewReader(soapBody))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "text/xml; charset=utf-8")
		req.Header.Set("SOAPAction", `"http://tempuri.org/CalcPrecoPrazo"`)

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}

		// Resposta mal formada para esse servico: pula para o proximo em vez
		// de falhar a cotacao inteira.
		var env correiosResponse
		if err := xml.Unmarshal(body, &env); err != nil {
			continue
		}

		// svc.Erro != 0 significa que os Correios recusaram cotar esse
		// servico para esse CEP/peso (ex.: area nao atendida) - ignora e
		// segue com as demais opcoes.
		for _, svc := range env.Body.CalcPrecoPrazoResponse.Servicos.CServico {
			if svc.Erro != 0 {
				continue
			}

			price := parseCorreiosPrice(svc.Valor)

			options = append(options, CorreiosOption{
				Service: cfg.service,
				Code:    cfg.code,
				Price:   price,
				Days:    svc.PrazoEntrega,
				Label:   fmt.Sprintf("%s - R$ %.2f - %d dias", cfg.service, price, svc.PrazoEntrega),
			})
		}
	}

	if len(options) == 0 {
		return nil, fmt.Errorf("nenhuma opcao de frete encontrada")
	}

	return options, nil
}

// parseCorreiosPrice converte o preco no formato brasileiro ("12,34") que os
// Correios devolvem para float64.
func parseCorreiosPrice(value string) float64 {
	value = strings.ReplaceAll(value, ",", ".")
	value = strings.TrimSpace(value)
	var price float64
	fmt.Sscanf(value, "%f", &price)
	return price
}
