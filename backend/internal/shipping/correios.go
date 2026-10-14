package shipping

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
)

type CorreiosOption struct {
	Service string
	Code    string
	Price   float64
	Days    int
	Label   string
}

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

func FetchCorreiosOptions(cepOrigem, cepDestino string, weightGrams int) ([]CorreiosOption, error) {
	cepDestino = strings.ReplaceAll(cepDestino, "-", "")
	cepOrigem = strings.ReplaceAll(cepOrigem, "-", "")

	if len(cepDestino) != 8 || len(cepOrigem) != 8 {
		return nil, fmt.Errorf("CEP invalido")
	}

	weight := float64(weightGrams) / 1000.0
	if weight < 0.3 {
		weight = 0.3
	}

	configs := []struct {
		code    string
		service string
	}{
		{"04014", "SEDEX"},
		{"04510", "PAC"},
	}

	options := []CorreiosOption{}

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

		var env correiosResponse
		if err := xml.Unmarshal(body, &env); err != nil {
			continue
		}

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

func parseCorreiosPrice(value string) float64 {
	value = strings.ReplaceAll(value, ",", ".")
	value = strings.TrimSpace(value)
	var price float64
	fmt.Sscanf(value, "%f", &price)
	return price
}
