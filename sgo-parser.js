/**
 * sgo-parser.js - Módulo de Extração de Orçamentos (Excel/CSV e PDF)
 */

window.extrairDadosPlanilhaExcel = async function(file) {
  if (!window.XLSX) {
    throw new Error("Biblioteca SheetJS (XLSX) não foi carregada no navegador.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // 1. Procura a aba solicitada (ou primeira aba disponível)
  let nomeAba = workbook.SheetNames.find(n => n.toUpperCase().includes("ORÇ ESC 1ª FASE") || n.toUpperCase().includes("ORC ESC"));
  if (!nomeAba) {
    nomeAba = workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[nomeAba];
  // header: 1 transforma a aba em matriz de arrays puros (linha x coluna)
  const linhas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  if (!linhas || linhas.length === 0) {
    throw new Error(`A aba "${nomeAba}" está vazia.`);
  }

  let itens = [];
  let categoriaAtual = "SERVIÇOS PRELIMINARES";

  // 2. Varredura Linha a Linha
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    if (!linha || linha.length === 0) continue;

    // Colunas mapeadas (índice baseado em 0):
    // D = linha[3] (Número do Item)
    // E = linha[4] (Código da Composição)
    // H = linha[7] (Nome / Descrição)
    // I = linha[8] (Quantidade)
    // J = linha[9] (Unidade)
    const itemNumRaw = String(linha[3] !== undefined ? linha[3] : "").trim();
    const codigoRaw  = String(linha[4] !== undefined ? linha[4] : "").trim();
    const nomeRaw    = String(linha[7] !== undefined ? linha[7] : "").trim();
    const qtdRaw     = linha[8];
    const unidadeRaw = String(linha[9] !== undefined ? linha[9] : "").trim();

    if (!itemNumRaw && !codigoRaw && !nomeRaw) continue;

    // Converte vírgula decimal se vier como texto
    let qtdNumerica = 0;
    if (typeof qtdRaw === "number") {
      qtdNumerica = qtdRaw;
    } else if (typeof qtdRaw === "string" && qtdRaw.trim() !== "") {
      qtdNumerica = parseFloat(qtdRaw.replace(/\./g, "").replace(",", "."));
    }

    // Regra da Coluna D:
    // Se o número for inteiro (ex.: "1", "2", "3"), é título de categoria
    // Se tiver ponto/decimal (ex.: "1.1", "2.3") ou se tiver código válido, é composição
    const itemNumLimpo = itemNumRaw.replace(",", ".");
    const isNumeroInteiro = /^\d+$/.test(itemNumLimpo);
    const isDecimal = /^\d+\.\d+/.test(itemNumLimpo);

    if (isNumeroInteiro && nomeRaw && !codigoRaw) {
      categoriaAtual = nomeRaw;
      continue;
    }

    // Se possui código de composição ou é item decimal com quantidade válida
    if (codigoRaw || (isDecimal && nomeRaw)) {
      // Ignora linhas de cabeçalho da planilha
      if (codigoRaw.toUpperCase() === "CÓDIGO" || nomeRaw.toUpperCase() === "DESCRIÇÃO") {
        continue;
      }

      const codFinal = codigoRaw || itemNumLimpo;
      const unFinal = unidadeRaw.toUpperCase() || "UN";

      itens.push({
        itemNum: itemNumLimpo,
        codigo: codFinal,
        desc: nomeRaw.slice(0, 150),
        un: unFinal,
        qtd: isNaN(qtdNumerica) ? 0 : qtdNumerica,
        grupo: categoriaAtual
      });
    }
  }

  if (itens.length === 0) {
    throw new Error(`Nenhuma composição encontrada na aba "${nomeAba}". Verifique as colunas D, E, H, I, J.`);
  }

  // Tenta extrair o nome do arquivo limpo como demanda/escola
  const nomeArquivoLimpo = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");

  return {
    uid: "oat_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    id: "ORC-" + Date.now().toString().slice(-4),
    demanda: "OAT/" + new Date().getFullYear() + "/" + Date.now().toString().slice(-4),
    nome: nomeArquivoLimpo.slice(0, 45).toUpperCase(),
    municipio: "RS",
    valorGlobal: 0,
    itens: itens
  };
};

/**
 * Fallback para PDF (mantido caso receba somente PDF)
 */
window.extrairDadosOrcamentoSGO = async function(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer), disableFontFace: true }).promise;
  let todasLinhas = [];
  let textoBruto = "";

  for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
    const page = await pdf.getPage(pNum);
    const textContent = await page.getTextContent();
    let yBuckets = {};

    textContent.items.forEach(it => {
      const str = it.str ? it.str.trim() : "";
      if (!str) return;
      textoBruto += str + " ";
      const yCoord = Math.round(it.transform[5]);
      let foundKey = Object.keys(yBuckets).find(k => Math.abs(k - yCoord) <= 3);
      if (!foundKey) {
        foundKey = yCoord;
        yBuckets[foundKey] = [];
      }
      yBuckets[foundKey].push({ str: str, x: it.transform[4] });
    });

    const sortedYs = Object.keys(yBuckets).map(Number).sort((a, b) => b - a);
    sortedYs.forEach(y => {
      const rowItems = yBuckets[y].sort((a, b) => a.x - b.x);
      const lineStr = rowItems.map(i => i.str).join(" ").trim();
      if (lineStr) todasLinhas.push(lineStr);
    });
  }

  const matchDemanda = textoBruto.match(/Número:\s*(SOP\/\d{4}\/\d+)/i) || ["", "SOP/" + new Date().getFullYear() + "/001"];
  const matchImovel = textoBruto.match(/Imóvel:\s*([^\n\r]+?)(?=\s*Município|\s*Cliente|$)/i) || ["", "PRÉDIO ESCOLAR"];
  const matchMunicipio = textoBruto.match(/Município:\s*([^\n\r]+?)(?=\s*Cliente|\s*Orçamento|$)/i) || ["", "RS"];
  const matchValor = textoBruto.match(/Total do Orçamento[\s\S]*?([\d\.]+\,\d{2})/i) || ["", "0,00"];

  let itens = [];
  let grupoAtual = "SERVIÇOS DE CANTEIRO DE OBRA";

  for (let i = 0; i < todasLinhas.length; i++) {
    let linha = todasLinhas[i].trim();
    let matchCod = linha.match(/^(SOP[X\d]\w*|CPXX?\w*|CSTXX?\w*|\d{5,6})\b/i);
    if (matchCod) {
      let cod = matchCod[1].toUpperCase();
      let mQtd = linha.match(/(\d{1,4}(?:\.\d{3})*,\d{2})\s*(M2|m²|UN|H|Η|M3|KG|M3XKM|MXMES|M|pto|un)\b/i);
      let qtd = mQtd ? parseFloat(mQtd[1].replace(/\./g, "").replace(",", ".")) : 1.0;
      let un = mQtd ? mQtd[2].toUpperCase().replace("Η", "H") : "UN";
      let desc = linha.replace(matchCod[0], "").trim();

      itens.push({
        codigo: cod,
        desc: desc.slice(0, 140),
        un: un,
        qtd: qtd,
        grupo: grupoAtual
      });
    }
  }

  return {
    uid: "oat_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    id: matchDemanda[1].split("/").pop() || Date.now().toString().slice(-4),
    demanda: matchDemanda[1].trim(),
    nome: matchImovel[1].trim(),
    municipio: matchMunicipio[1].trim(),
    valorGlobal: parseFloat(matchValor[1].replace(/\./g, "").replace(",", ".")) || 0,
    itens: itens
  };
};
