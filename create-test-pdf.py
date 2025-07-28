from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter

def create_test_receipt():
    filename = "test-receipt.pdf"
    c = canvas.Canvas(filename, pagesize=letter)
    
    # Add content to the PDF
    c.drawString(100, 750, "COMPROVANTE DE PAGAMENTO")
    c.drawString(100, 720, "=" * 40)
    c.drawString(100, 680, "Data: 28/07/2025")
    c.drawString(100, 660, "Estabelecimento: Restaurante Teste")
    c.drawString(100, 640, "CNPJ: 12.345.678/0001-90")
    c.drawString(100, 620, "Valor: R$ 114,99")
    c.drawString(100, 600, "Descrição: Almoço executivo")
    c.drawString(100, 560, "Este é um arquivo de teste para simular um comprovante de reembolso.")
    
    c.save()
    print(f"PDF criado: {filename}")

if __name__ == "__main__":
    create_test_receipt()
