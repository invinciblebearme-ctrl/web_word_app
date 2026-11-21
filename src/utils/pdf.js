// 화면 밖에 그려 둔 학습지 영역을 A4 PDF로 저장한다 (단어장, 나만의 문장)
// PDF 라이브러리(약 500KB)는 버튼을 눌렀을 때만 불러온다
export const exportElementToPdf = async (element, filename) => {
  // 캡처 전 스크롤을 상단으로 이동 (html2canvas 오프셋 방지)
  window.scrollTo(0, 0)
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: 800, // 캔버스 너비 고정
    onclone: (clonedDoc) => {
      const el = element.id && clonedDoc.getElementById(element.id)
      if (el) el.style.display = 'block'
    },
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const imgWidth = 210
  const pageHeight = 297
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
  heightLeft -= pageHeight
  while (heightLeft > 0) { // 딱 맞게 끝나면 빈 페이지를 더하지 않는다
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight
  }
  pdf.save(filename)
}
