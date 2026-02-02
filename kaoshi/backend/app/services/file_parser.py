import io
import markdown
from fastapi import UploadFile, HTTPException
from docx import Document
from pypdf import PdfReader

class FileParser:
    @staticmethod
    async def parse_file(file: UploadFile) -> str:
        """
        Parse uploaded file content into text string.
        Supports .txt, .md, .doc, .docx, .pdf
        """
        filename = file.filename.lower()
        content = await file.read()
        
        try:
            if filename.endswith(('.txt', '.md')):
                return content.decode('utf-8')
            
            elif filename.endswith(('.doc', '.docx')):
                return FileParser._parse_docx(content)
            
            elif filename.endswith('.pdf'):
                return FileParser._parse_pdf(content)
            
            else:
                raise HTTPException(status_code=400, detail="Unsupported file format")
                
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    @staticmethod
    def _parse_docx(content: bytes) -> str:
        doc = Document(io.BytesIO(content))
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])

    @staticmethod
    def _parse_pdf(content: bytes) -> str:
        reader = PdfReader(io.BytesIO(content))
        text = []
        for page in reader.pages:
            text.append(page.extract_text())
        return "\n".join(text)
