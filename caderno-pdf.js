/**
 * caderno-pdf.js - Gerador Oficial de Caderno de Medições (SOP/RS)
 */

window.gerarCadernoMedicaoPDF = async function(obra, numMedicao) {
  if (!window.jspdf) {
    alert("Biblioteca jsPDF não carregada.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const azulEscuro = [30, 58, 138];
  const cinzaTexto = [71, 85, 105];

  // ==========================================
  // PÁGINA 1: CAPA INSTITUCIONAL
  // ==========================================
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(1);
  doc.rect(10, 10, 190, 277);

  // Topo Institucional
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...azulEscuro);
  doc.text("ESTADO DO RIO GRANDE DO SUL", 105, 25, { align: "center" });
  doc.text("SECRETARIA DE OBRAS PÚBLICAS — SOP/RS", 105, 31, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("SISTEMA DE GESTÃO DE OBRAS — CADERNO DE FISCALIZAÇÃO", 105, 36, { align: "center" });

  doc.setLineWidth(0.5);
  doc.line(20, 42, 190, 42);

  // Título da Medição
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`BOLETIM DE MEDIÇÃO Nº ${String(numMedicao).padStart(2, "0")}`, 105, 60, { align: "center" });

  // Bloco de Identificação do Contrato
  doc.setFontSize(9);
  doc.setFillColor(241, 245, 249);
  doc.rect(20, 75, 170, 75, "F");

  doc.setTextColor(30, 58, 138);
  doc.text("DADOS DA DEMANDA / CONTRATO", 25, 84);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`Estabelecimento: ${obra.nome}`, 25, 93);
  doc.text(`Demanda SGO / OAT: ${obra.demanda}`, 25, 101);
  doc.text(`Código do Prédio: ${obra.id}`, 25, 109);
  doc.text(`Município: ${obra.municipio}`, 25, 117);
  doc.text(`Valor Contratual: R$ ${obra.valorGlobal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 25, 125);
  doc.text(`Data de Emissão: ${new Date().toLocaleDateString("pt-BR")}`, 25, 133);
  doc.text(`Status: Medição Regular de Aferição em Canteiro`, 25, 141);

  // Quadro de Assinaturas
  doc.line(30, 235, 95, 235);
  doc.text("Fiscal do Estado (SOP/RS)", 62.5, 240, { align: "center" });

  doc.line(115, 235, 180, 235);
  doc.text("Responsável Técnico (Contratada)", 147.5, 240, { align: "center" });

  // ==========================================
  // PÁGINA 2: PLANILHA RESUMO (ESPELHO SGO)
  // ==========================================
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
      it.desc.slice(0, 45),
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
    headStyles: { fillColor: [30, 58, 138], fontSize: 7, halign: "center" },
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 16 },
      2: { cellWidth: 62 },
      3: { halign: "center", cellWidth: 10 },
      4: { halign: "right", cellWidth: 18 },
      5: { halign: "right", cellWidth: 18 },
      6: { halign: "right", cellWidth: 18, fontStyle: "bold" },
      7: { halign: "right", cellWidth: 18 },
      8: { halign: "right", cellWidth: 18 }
    }
  });

  // ==========================================
  // PÁGINAS SEGUINTES: FICHAS DE CROQUIS E EVIDÊNCIAS
  // (Apenas para itens que tiveram medição > 0 ou croqui salvo)
  // ==========================================
  for (let it of obra.itens) {
    const chaveItem = `med_${obra.uid}_${it.codigo}_${numMedicao}`;
    const d = JSON.parse(localStorage.getItem(chaveItem)) || { ant: 0, per: 0, mem: "" };

    // Se o item foi medido no período ou possui memória digitada, gera folha individual
    if (d.per > 0 || d.mem) {
      doc.addPage();

      // Cabeçalho da Ficha
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...azulEscuro);
      doc.text(`MEMÓRIA DE MEDIÇÃO — ITEM: ${it.codigo}`, 14, 16);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(`Serviço: ${it.desc}`, 14, 22, { maxWidth: 180 });

      // Dados Físicos
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 30, 182, 14, "F");
      doc.text(`Contrato: ${it.qtd.toFixed(2)} ${it.un}   |   Anterior: ${d.ant.toFixed(2)} ${it.un}   |   Período: ${d.per.toFixed(2)} ${it.un}   |   Saldo: ${(it.qtd - (d.ant + d.per)).toFixed(2)} ${it.un}`, 18, 38);

      // Memória Aritmética
      doc.setFont("helvetica", "bold");
      doc.text("Memória de Cálculo Aritmética:", 14, 52);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(d.mem || "Medição calculada por conferência visual direta em canteiro.", 14, 58, { maxWidth: 180 });

      // Inclusão do Croqui Cotado (Canvas)
      const canvasEl = document.getElementById(`canvas_${it.codigo}`);
      if (canvasEl) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text("Croqui Cotado de Campo:", 14, 74);
        
        const canvasImgData = canvasEl.toDataURL("image/png");
        // Adiciona a imagem com borda suave
        doc.setDrawColor(203, 213, 225);
        doc.rect(14, 78, 182, 90);
        doc.addImage(canvasImgData, "PNG", 14, 78, 182, 90);
      }

      // Rodapé da Folha Individual
      doc.setFontSize(7);
      doc.setTextColor(...cinzaTexto);
      doc.text(`Caderno de Fiscalização SOP/RS — OAT: ${obra.demanda} — Medição Nº ${numMedicao}`, 14, 285);
    }
  }

  // Grava e dispara o download do PDF completo
  const nomeArquivo = `Caderno_Medicao_${obra.demanda.replace(/[\/\\]/g, "_")}_MED${String(numMedicao).padStart(2, "0")}.pdf`;
  doc.save(nomeArquivo);
};
