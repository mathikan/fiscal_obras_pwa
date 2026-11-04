/**
 * sgo-parser.js - Módulo Especialista em Extração Tabular do SGO (SOP/RS)
 */

window.extrairDadosOrcamentoSGO = async function(file) {
  if (!window.pdfjsLib) {
    throw new Error("Biblioteca PDF.js não foi carregada no navegador.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true,
    nativeImageDecoderSupport: 'none'
  });
  
  const pdf = await loadingTask.promise;
  let todasLinhas = [];
  let textoBruto = "";

  // 1. Varrer páginas e ordenar espacialmente: Topo -> Fim (Y), Esquerda -> Direita (X)
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

  // 2. Extração dos Metadados Principais
  const matchDemanda = textoBruto.match(/Número:\s*(SOP\/\d{4}\/\d+)/i) || ["", "SOP/" + new Date().getFullYear() + "/001"];
  const matchImovel = textoBruto.match(/Imóvel:\s*([^\n\r]+?)(?=\s*Município|\s*Cliente|$)/i) || ["", "PRÉDIO ESCOLAR"];
  const matchMunicipio = textoBruto.match(/Município:\s*([^\n\r]+?)(?=\s*Cliente|\s*Orçamento|$)/i) || ["", "RS"];
  const matchValor = textoBruto.match(/Total do Orçamento[\s\S]*?([\d\.]+\,\d{2})/i) || ["", "0,00"];

  // 3. Extração das Composições
  let itens = [];
  let grupoAtual = "SERVIÇOS DE CANTEIRO DE OBRA";

  const macroetapas = [
    "SERV INICIAIS DE INSTALAÇÃO DA OBRA", "MOBILIZAÇÃO",
    "ADMINISTRAÇÃO DIRETA DA OBRA", "DEMOLIÇÕES",
    "RECUPERAÇÃO ESTRUTURAL", "ESQUADRIAS", "COBERTURA",
    "REVEST DE PISOS, PAREDES E FORROS", "PINTURAS E TEXTURAS",
    "MUROS, TELAS E ACESSO ESCOLAR", "REGISTRO DO EXECUTADO"
  ];

  let i = 0;
  while (i < todasLinhas.length) {
    let linha = todasLinhas[i].trim();

    for (let me of macroetapas) {
      if (linha.includes(me) && !linha.startsWith("Total de")) {
        grupoAtual = me;
      }
    }

    let matchCod = linha.match(/^(SOP[X\d]\w*|CPXX?\w*|CSTXX?\w*|\d{5,6})\b/i);
    if (matchCod) {
      let cod = matchCod[1].toUpperCase();

      if ((cod === "100326" && linha.includes("ADAPTADA")) || 
          (cod === "SOPX29" && linha.includes("SERV INICIAIS")) ||
          (cod === "160386") ||
          linha.startsWith("Total de ")) {
        i++;
        continue;
      }

      let bloco = [linha.replace(matchCod[0], "").trim()];
      let j = i + 1;
      while (j < todasLinhas.length && (j - i) <= 8) {
        let prox = todasLinhas[j].trim();
        if (prox.match(/^(SOP[X\d]\w*|CPXX?\w*|CSTXX?\w*|\d{5,6})\b/i) && 
            !(prox.startsWith("100326") && prox.includes("ADAPTADA")) &&
            !prox.startsWith("160386")) {
          break;
        }
        if (prox.startsWith("Total de") || prox.startsWith("Página0")) {
          break;
        }
        bloco.push(prox);
        j++;
      }

      let blocoTexto = bloco.join(" ");
      let mQtd = blocoTexto.match(/(\d{1,4}(?:\.\d{3})*,\d{2})\s*(M2|m²|UN|H|Η|M3|KG|M3XKM|MXMES|MXME\s*S|M|pto|un)\b/i);
      let mInv = blocoTexto.match(/\b(M2|m²|UN|H|M3|KG|M)\s+(\d{1,4}(?:\.\d{3})*,\d{2})\b/i);

      let qtd = 1.0;
      let un = "UN";
      let desc = blocoTexto;

      if (mQtd) {
        qtd = parseFloat(mQtd[1].replace(/\./g, "").replace(",", "."));
        un = mQtd[2].toUpperCase().replace("Η", "H").replace(/\s+/g, "");
        let cut = blocoTexto.indexOf(mQtd[0]);
        if (cut > 0) desc = blocoTexto.substring(0, cut).trim();
      } else if (mInv) {
        qtd = parseFloat(mInv[2].replace(/\./g, "").replace(",", "."));
        un = mInv[1].toUpperCase();
        let cut = blocoTexto.indexOf(mInv[0]);
        if (cut > 0) desc = blocoTexto.substring(0, cut).trim();
      }

      desc = desc.replace(/\(REF\..*?\)/gi, "")
                 .replace(/AF_\d{2}\/\d{4}/gi, "")
                 .replace(/\s+/g, " ")
                 .trim();

      if (!desc) desc = "Serviço de Engenharia";

      if (!itens.some(it => it.codigo === cod)) {
        itens.push({
          codigo: cod,
          desc: desc.slice(0, 140),
          un: un,
          qtd: qtd,
          grupo: grupoAtual
        });
      }

      i = j - 1;
    }
    i++;
  }

  if (itens.length === 0) {
    throw new Error("Nenhuma composição identificada no layout do arquivo.");
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
