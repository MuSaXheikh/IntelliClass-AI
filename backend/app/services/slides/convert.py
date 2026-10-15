"""Accept PDF, PowerPoint (.ppt, .pptx) and OpenDocument (.odp) decks; everything becomes PDF.

PowerPoint and ODP files are converted by LibreOffice in headless mode with a throwaway user
profile, so parallel uploads do not fight over a lock. Detection uses the file's own bytes,
not the name the browser sent, except for legacy .ppt (an OLE container shared with .doc/.xls).
"""

import io
import logging
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from app.core.errors import ApiError

logger = logging.getLogger(__name__)

ACCEPTED = "PDF, PowerPoint (.pptx, .ppt) or OpenDocument (.odp)"
_OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_ODP_MIME = b"application/vnd.oasis.opendocument.presentation"


def detect_kind(data: bytes, filename: str = "") -> str | None:
    """Return 'pdf', 'pptx', 'ppt' or 'odp', or None when the bytes are none of those."""
    if data.startswith(b"%PDF"):
        return "pdf"
    if data.startswith(_OLE_MAGIC):
        return "ppt" if filename.lower().endswith((".ppt", ".pps", ".pot")) else None
    if data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                names = set(zf.namelist())
                if "ppt/presentation.xml" in names:
                    return "pptx"
                if "mimetype" in names and zf.read("mimetype").strip() == _ODP_MIME:
                    return "odp"
        except zipfile.BadZipFile:
            return None
    return None


def to_pdf(data: bytes, filename: str, soffice: str, timeout_s: float) -> bytes:
    """PDF bytes for any accepted deck. Raises ApiError with a message the user can act on."""
    kind = detect_kind(data, filename)
    if kind is None:
        raise ApiError(400, "INVALID_FILE", f"Only {ACCEPTED} decks are accepted")
    if kind == "pdf":
        return data
    if shutil.which(soffice) is None:
        raise ApiError(
            415,
            "CONVERTER_MISSING",
            "This server cannot convert presentations; export the deck to PDF and upload that",
        )
    with tempfile.TemporaryDirectory(prefix="deck-") as tmp:
        src = Path(tmp) / f"deck.{kind}"
        src.write_bytes(data)
        profile = (Path(tmp) / "profile").as_uri()
        cmd = [
            soffice,
            "--headless",
            "--norestore",
            "--nologo",
            f"-env:UserInstallation={profile}",
            "--convert-to",
            "pdf",
            "--outdir",
            tmp,
            str(src),
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=timeout_s, check=False)
        except subprocess.TimeoutExpired as exc:
            raise ApiError(
                400, "CONVERSION_TIMEOUT", "Converting this deck took too long; export it to PDF"
            ) from exc
        out = src.with_suffix(".pdf")
        if proc.returncode != 0 or not out.exists():
            logger.warning("soffice failed rc=%s: %s", proc.returncode, proc.stderr[-400:])
            raise ApiError(
                400, "CONVERSION_FAILED", "Could not convert this deck; export it to PDF"
            )
        logger.info("converted %s deck (%d bytes) to pdf", kind, len(data))
        return out.read_bytes()
