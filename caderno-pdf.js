/**
 * caderno-pdf.js - Gerador Oficial de Caderno de Medições (SOP/RS)
 * Diagramação lado a lado: Croqui Cotado (Esquerda) + Foto de Campo (Direita)
 */

window.gerarCadernoMedicaoPDF = async function(obra, numMedicao) {
  if (!window.jspdf) {
    alert("Biblioteca jsPDF não foi carregada no navegador.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const azulEscuro = [30, 58, 138];
  const azulBorda = [191, 219, 254];
  const cinzaTexto = [71, 85, 105];
  const cinzaFundo = [248, 250, 252];

  // =========================================================================
  // PÁGINA 1: CAPA OFICIAL INSTITUCIONAL
  // =========================================================================
  doc.setDrawColor(...azulEscuro);
  doc.setLineWidth(1);
  doc.rect(10, 10, 190, 277);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...azulEscuro);
  doc.text("ESTADO DO RIO GRANDE DO SUL", 105, 25, { align: "center" });
  doc.text("SECRETARIA DE OBRAS PÚBLICAS — SOP/RS", 105, 31, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("SISTEMA DE GESTÃO DE OBRAS — LIVRO MESTRE DE MEDIÇÕES", 105, 36, { align: "center" });

  doc.setLineWidth(0.5);
  doc.line(20, 42, 190, 42);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`BOLETIM DE MEDIÇÃO Nº ${String(numMedicao).padStart(2, "0")}`, 105, 62, { align: "center" });

  // Bloco de Dados Cadastrais
  doc.setFontSize(9);
  doc.setFillColor(...cinzaFundo);
  doc.setDrawColor(...azulBorda);
  doc.roundedRect(20, 78, 170, 78, 2, 2, "FD");

  doc.setTextColor(...azulEscuro);
  doc.text("IDENTIFICAÇÃO DO CONTRATO E DEMANDA", 26, 88);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`Estabelecimento: ${obra.nome}`, 26, 97);
  doc.text(`Demanda SGO / OAT: ${obra.demanda}`, 26, 105);
  doc.text(`Código do Prédio: ${obra.id}`, 26, 113);
  doc.text(`Município: ${obra.municipio}`, 26, 121);
  doc.text(`Valor Contratual: R$ ${obra.valorGlobal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 26, 129);
  doc.text(`Data da Vistoria: ${new Date().toLocaleDateString("pt-BR")}`, 26, 137);
  doc.text(`Ambiente: Vistoria Técnica de Engenharia em Canteiro`, 26, 145);

  // Termo de Encerramento e Assinaturas
  doc.line(30, 235, 95, 235);
  doc.setFontSize(8);
  doc.text("Fiscal do Estado (SOP/RS)", 62.5, 240, { align: "center" });

  doc.line(115, 235, 180, 235);
  doc.text("Responsável Técnico (Contratada)", 147.5, 240, { align: "center" });

  // =========================================================================
  // PÁGINA 2: PLANILHA RESUMO CONSOLIDADA (ESPELHO SGO)
  // =========================================================================
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...azulEscuro);
  doc.text("PLANILHA RESUMO DE MEDIÇÃO — ESPELHO SGO", 14, 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...cinzaTexto);
  doc.text(`${obra.nome} | OAT ${obra.demanda} | Medição Nº ${numMedicao}`, 14, 23);

  const linhasTabela = obra.itens.map((it, idx) => {
    const chaveItem = `med_${obra.uid}_${it.codigo}_${numMedicao}`;
    const d = JSON.parse(localStorage.getItem(chaveItem)) || { ant: 0, per: 0 };
    const acum = d.ant + d.per;
    const saldo = it.qtd - acum;
    return [
      idx + 1,
      it.codigo,
      it.desc.slice(0, 42),
      it.un,
      it.qtd.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      d.ant.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      d.per.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      acum.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    ];
  });

  doc.autoTable({
    startY: 28,
    head: [["Item", "Cód.", "Descrição do Serviço", "Un.", "Contrato", "Anterior", "Período", "Acumulado", "Saldo"]],
    body: linhasTabela,
    theme: "striped",
    headStyles: { fillColor: azulEscuro, fontSize: 7, halign: "center" },
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    columnStyles: {
      0: { halign: "center", cellWidth: 9 },
      1: { halign: "center", cellWidth: 16 },
      2: { cellWidth: 63 },
      3: { halign: "center", cellWidth: 10 },
      4: { halign: "right", cellWidth: 18 },
      5: { halign: "right", cellWidth: 18 },
      6: { halign: "right", cellWidth: 18, fontStyle: "bold" },
      7: { halign: "right", cellWidth: 18 },
      8: { halign: "right", cellWidth: 18 }
    }
  });

  // =========================================================================
  // PÁGINAS INDIVIDUAIS: FICHAS TÉCNICAS COM CROQUI E FOTO LADO A LADO
  // =========================================================================
  for (let it of obra.itens) {
    const chaveItem = `med_${obra.uid}_${it.codigo}_${numMedicao}`;
    const d = JSON.parse(localStorage.getItem(chaveItem)) || { ant: 0, per: 0, mem: "" };
    
    // Recupera a foto salva no armazenamento local
    const chaveFoto = `foto_${obra.uid}_${it.codigo}_${numMedicao}`;
    const fotoBase64 = localStorage.getItem(chaveFoto);

    // Recupera o desenho do croqui pelo canvas ativo ou cache
    const chaveCroqui = `croqui_${obra.uid}_${it.codigo}_${numMedicao}`;
    let croquiBase64 = localStorage.getItem(chaveCroqui);
    if (!croquiBase64) {
      const canvasEl = document.getElementById(`canvas_${it.codigo}`);
      if (canvasEl) {
        croquiBase64 = canvasEl.toDataURL("image/png");
      }
    }

    // Gera folha técnica se o item teve medição no período, memória escrita ou evidência visual
    if (d.per > 0 || d.mem || fotoBase64) {
      doc.addPage();

      // Cabeçalho da Ficha
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...azulEscuro);
      doc.text(`MEMÓRIA DE MEDIÇÃO — COMPOSIÇÃO ${it.codigo}`, 14, 16);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Etapa: ${it.grupo}  |  Serviço: ${it.desc}`, 14, 22, { maxWidth: 182 });

      // Faixa Métrica de Quantitativos
      doc.setFillColor(...cinzaFundo);
      doc.setDrawColor(...azulBorda);
      doc.roundedRect(14, 28, 182, 14, 1.5, 1.5, "FD");

      doc.setFontSize(8);
      const txtMetrico = `Contratado: ${it.qtd.toFixed(2)} ${it.un}    |    Med. Anterior: ${d.ant.toFixed(2)} ${it.un}    |    Nesta Medição: ${d.per.toFixed(2)} ${it.un}    |    Saldo: ${(it.qtd - (d.ant + d.per)).toFixed(2)} ${it.un}`;
      doc.text(txtMetrico, 18, 37);

      // Caixa de Memória Aritmética
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...azulEscuro);
      doc.text("Memória de Cálculo Aritmética / Dimensões:", 14, 50);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(d.mem || "Medição aferida por conferência métrica visual direta em canteiro de obras.", 14, 56, { maxWidth: 182 });

      // =====================================================================
      // ÁREA VISUAL: QUADRO DUPLO LADO A LADO (LARGURA TOTAL = 182 mm)
      // Caixa 1 (Croqui): X=14 mm, W=88 mm, H=105 mm
      // Caixa 2 (Foto):   X=108 mm, W=88 mm, H=105 mm
      // =====================================================================
      const boxY = 66;
      const boxW = 88;
      const boxH = 105;

      // --- LADO ESQUERDO: CROQUI COTADO ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...azulEscuro);
      doc.text("1. Croqui Cotado / Esquema Gráfico", 14, boxY - 2);

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(14, boxY, boxW, boxH, 1, 1, "FD");

      if (croquiBase64) {
        doc.addImage(croquiBase64, "PNG", 14.5, boxY + 0.5, boxW - 1, boxH - 1);
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Nenhum croqui registrado", 14 + (boxW / 2), boxY + (boxH / 2), { align: "center" });
      }

      // --- LADO DIREITO: FOTOGRAFIA DE CAMPO ---
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...azulEscuro);
      doc.text("2. Evidência Fotográfica de Campo", 108, boxY - 2);

      doc.setDrawColor(203, 213, 225);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(108, boxY, boxW, boxH, 1, 1, "FD");

      if (fotoBase64) {
        doc.addImage(fotoBase64, "JPEG", 108.5, boxY + 0.5, boxW - 1, boxH - 1);
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Nenhuma fotografia anexada", 108 + (boxW / 2), boxY + (boxH / 2), { align: "center" });
      }

      // Notas Técnicas do Item / Parecer
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...azulEscuro);
      doc.text("Parecer do Fiscal / Observações:", 14, 182);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text("Serviço executado em conformidade com as especificações técnicas, projetos executivos e normas regulamentadoras vigentes no Estado do Rio Grande do Sul.", 14, 188, { maxWidth: 182 });

      // Rodapé da Folha Individual
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 280, 196, 280);
      doc.setFontSize(7);
      doc.setTextColor(...cinzaTexto);
      doc.text(`Caderno Oficial de Fiscalização SOP/RS — OAT: ${obra.demanda} — Medição Nº ${numMedicao}`, 14, 285);
      doc.text(`Folha Técnica: Item ${it.codigo}`, 196, 285, { align: "right" });
    }
  }

  // Gera o nome padronizado do arquivo e dispara o download nativo
  const idOAT = obra.demanda.replace(/[\/\\]/g, "_");
  const nomeArquivo = `Caderno_Fiscalizacao_${idOAT}_MED${String(numMedicao).padStart(2, "0")}.pdf`;
  doc.save(nomeArquivo);
};
