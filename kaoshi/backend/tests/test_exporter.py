from app.services import exporter

def test_export_formats():
    paper_data = {
        "title": "Exporter Test Paper",
        "questions_snapshot": [
            {
                "id": 1,
                "q_type": "single",
                "content": "Which one is correct?",
                "options": ["A. 1", "B. 2", "C. 3", "D. 4"],
                "answer": "A",
                "analysis": "Because 1 is correct.",
                "difficulty": 2,
                "score": 2.0,
                "tags": ["demo"],
            },
            {
                "id": 2,
                "q_type": "essay",
                "content": "Explain the concept.",
                "options": None,
                "answer": "A reference answer.",
                "analysis": "Key points ...",
                "difficulty": 3,
                "score": 10.0,
                "tags": ["demo"],
            },
        ],
    }

    docx_stream = exporter.export_to_docx(paper_data, include_answers=True)
    assert docx_stream.getbuffer().nbytes > 0

    pdf_stream = exporter.export_to_pdf(paper_data, include_answers=True)
    assert pdf_stream.getbuffer().nbytes > 0

    txt_stream = exporter.export_to_txt(paper_data, include_answers=True)
    txt_bytes = txt_stream.getvalue()
    assert len(txt_bytes) > 0
    assert b"Exporter Test Paper" in txt_bytes

if __name__ == "__main__":
    test_export_formats()
    print("✅ Exporter tests passed")

