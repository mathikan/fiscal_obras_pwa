/**
 * sgo-parser.js - Módulo Especialista em Importação de Orçamentos via CSV
 * Mapeamento: Coluna D (Item/Categoria), E (Código), H (Descrição), I (Quantidade), J (Unidade)
 */

window.extrairDadosOrcamentoCSV = async function(file) {
  const texto = await file.text();
  
  // Detecta se o delimitador é ponto e vírgula (padrão Excel PT-BR) ou vírgula
  const primeiraLinha = texto.split(/\r?\n/)[0] || "";
  const delimitador = (primeiraLinha.split(";").length >= primeiraLinha.split(",").length) ? ";" : ",";

  // Função para parsear linha de CSV respeitando aspas duplas
  function parsearLinhaCSV(linhaStr, delim) {
    let valores = [];
    let dentroAspas = false;
    let valorAtual = "";
    
    for (let i = 0; i < linhaStr.length; i++) {
      const c = linhaStr[i];
      if (c === '"') {
        if (dentroAspas && linhaStr[i + 1] === '"') {
          valorAtual += '"';
          i++;
        } else {
          dentroAspas = !dentroAspas;
        }
      } else if (c === delim && !dentroAspas) {
        valores.push(valorAtual.trim());
        valorAtual = "";
      } else {
        valorAtual += c;
      }
    }
    valores.push(valorAtual.trim());
    return valores;
  }

  // Divide o texto em linhas preservando quebras dentro de aspas
  const linhasBrutas = [];
  let buffer = "";
  let emAspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') emAspas = !emAspas;
    if ((c === '\n' || c === '\r') && !emAspas) {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      if (buffer.trim()) linhasBrutas.push(buffer);
      buffer = "";
    } else {
      buffer += c;
    }
  }
  if (buffer.trim()) linhasBrutas.push(buffer);

  if (linhasBrutas.length === 0) {
    throw new Error("O arquivo CSV está vazio.");
  }

  // 1. Extração de Metadados do Cabeçalho (Linhas 1 a 10)
  let nomeObra = "";
  let municipioObra = "RS";
  let idtObra = "";
  let valorGlobal = 0;

  for (let r = 0; r < Math.min(10, linhasBrutas.length); r++) {
    const colunas = parsearLinhaCSV(linhasBrutas[r], delimitador);
    for (let c = 0; c < colunas.length; c++) {
      const cel = colunas[c];
      if (/^OBRA:/i.test(cel) && colunas[c + 2]) {
        nomeObra = colunas[c + 2];
      }
      if (/^Município:/i.test(cel) && colunas[c + 1]) {
        municipioObra = colunas[c + 1];
      }
      if (/^IDT$/i.test(cel) && colunas[c + 1]) {
        idtObra = colunas[c + 1];
      }
      if (/^TOTAL ORÇAM/i.test(cel) && colunas[c + 1]) {
        valorGlobal = parseFloat(colunas[c + 1].replace(/\./g, "").replace(",", ".")) || 0;
      }
    }
  }

  if (!nomeObra) {
    nomeObra = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ").toUpperCase();
  }

  // 2. Extração das Composições Orçamentárias
  let itens = [];
  let categoriaAtual = "SERVIÇOS PRELIMINARES";

  for (let r = 0; r < linhasBrutas.length; r++) {
    const col = parsearLinhaCSV(linhasBrutas[r], delimitador);
    if (col.length < 10) continue;

    // Colunas oficiais:
    // D = col[3] (Nº Item)
    // E = col[4] (Código)
    // H = col[7] (Descrição / Categoria)
    // I = col[8] (Quantidade)
    // J = col[9] (Unidade)
    const itemNum = (col[3] || "").trim();
    const codigo = (col[4] || "").trim();
    const desc = (col[7] || "").trim();
    const qtdRaw = (col[8] || "").trim();
    const unidade = (col[9] || "").trim().toUpperCase();

    // Identifica linhas de cabeçalho e descarta
    if (itemNum.toUpperCase() === "Nº ITEM" || codigo.toUpperCase() === "CÓDIGO" || desc.toUpperCase() === "DESCRIÇÃO DO ITEM") {
      continue;
    }

    // Regra da Coluna D:
    // Números inteiros (ex: "1.", "2.", "3.") sem código na coluna E definem o nome da categoria
    const numLimpo = itemNum.replace(/\.$/, "").trim();
    const isNumeroInteiro = /^\d+$/.test(numLimpo);

    if (isNumeroInteiro && !codigo && desc) {
      categoriaAtual = desc;
      continue;
    }

    // Se possui código na coluna E, é uma composição válida
    if (codigo) {
      let qtd = 0;
      if (qtdRaw) {
        if (qtdRaw.includes(",")) {
          qtd = parseFloat(qtdRaw.replace(/\./g, "").replace(",", "."));
        } else {
          qtd = parseFloat(qtdRaw);
        }
      }

      itens.push({
        itemNum: itemNum,
        codigo: codigo,
        desc: desc.slice(0, 150),
        un: unidade || "UN",
        qtd: isNaN(qtd) ? 0 : qtd,
        grupo: categoriaAtual
      });
    }
  }

  if (itens.length === 0) {
    throw new Error("Nenhuma composição encontrada. Certifique-se de que exportou a aba 'ORÇ ESC 1ª FASE' em formato CSV.");
  }

  const idFinal = idtObra || Date.now().toString().slice(-4);

  return {
    uid: "oat_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    id: idFinal,
    demanda: "SOP/" + new Date().getFullYear() + "/" + idFinal,
    nome: nomeObra.slice(0, 60).toUpperCase(),
    municipio: municipioObra,
    valorGlobal: valorGlobal,
    itens: itens
  };
};
