
import io
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pypdf import PdfReader

from backend.auth import get_current_user

router = APIRouter(
    prefix="/api/documents",
    tags=["PDF Analysis"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/analyze")
async def analyze_project_pdf(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    # Validate the filename
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a PDF file.",
        )

    # Read and validate the uploaded file
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="PDF must be 10 MB or smaller.",
        )

    if not content.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is not a valid PDF.",
        )

    # Extract readable text
    try:
        reader = PdfReader(io.BytesIO(content))

        if reader.is_encrypted:
            raise HTTPException(
                status_code=400,
                detail="Password-protected PDFs are not supported.",
            )

        text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read this PDF.",
        )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No readable text found. "
                "This PDF may need OCR because it is scanned."
            ),
        )

    # Extract fields from clearly labelled PDF text
    def extract(pattern):
        match = re.search(
            pattern,
            text,
            re.IGNORECASE | re.MULTILINE,
        )
        return match.group(1).strip() if match else None

    project_name = extract(
        r"Project\s*Name\s*[:\-]\s*([^\r\n]+)"
    )

    location = extract(
        r"Location\s*[:\-]\s*([^\r\n]+)"
    )

    budget_text = extract(
        r"(?:Project\s*)?Budget\s*[:\-]\s*"
        r"(?:₹|Rs\.?|INR|\$)?\s*([\d,]+(?:\.\d+)?)"
    )

    start_date = extract(
        r"Start\s*Date\s*[:\-]\s*(\d{4}-\d{2}-\d{2})"
    )

    end_date = extract(
        r"(?:Expected\s*)?(?:End|Completion)\s*Date"
        r"\s*[:\-]\s*(\d{4}-\d{2}-\d{2})"
    )

    progress_text = extract(
        r"(?:Project\s*)?Progress\s*[:\-]\s*"
        r"(\d+(?:\.\d+)?)\s*%?"
    )

    return {
        "filename": file.filename,
        "extracted": {
            "name": project_name,
            "location": location,
            "budget": (
                float(budget_text.replace(",", ""))
                if budget_text
                else None
            ),
            "start_date": start_date,
            "expected_end_date": end_date,
            "progress": (
                float(progress_text)
                if progress_text
                else None
            ),
        },
        "text_preview": text[:1500],
        "needs_review": True,
        "message": (
            "Review the extracted fields before creating the project. "
            "Enter any missing fields manually."
        ),
    }
