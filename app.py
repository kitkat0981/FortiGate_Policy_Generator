"""
FortiGate Policy Generator - FastAPI web application.

Upload one or more FortiGate log files and interactively filter the records
by source IP, destination IP, destination port, and action. Generate FortiGate
firewall policy scripts from selected log records.
"""

from __future__ import annotations

import json
import shlex
from pathlib import Path
from typing import Iterable, List, Sequence

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates


BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="FortiGate Log Explorer")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def parse_log_line(line: str) -> dict:
    """
    Parse a single FortiGate log line into a dictionary of key/value pairs.
    """
    line = line.strip()
    if not line:
        return {}

    record: dict = {}
    tokens: List[str] = shlex.split(line)
    for token in tokens:
        if "=" not in token:
            continue
        key, value = token.split("=", 1)
        record[key] = value
    return record


def load_logs(files: Iterable[UploadFile]) -> List[dict]:
    """
    Parse uploaded log files into a list of dictionaries.
    """
    records: List[dict] = []

    for uploaded in files:
        contents = uploaded.file.read()
        uploaded.file.seek(0)
        lines = contents.decode("utf-8", errors="ignore").splitlines()
        for raw_line in lines:
            record = parse_log_line(raw_line)
            if record:
                # Preserve the original log line for display and exports.
                record["__raw_line"] = raw_line.strip()
                records.append(record)

    return records


def unique_values(records: Sequence[dict], key: str) -> List[str]:
    """
    Compute sorted unique values for a given key across log records.
    """
    values = {record.get(key, "") for record in records if record.get(key)}
    return sorted(values)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request) -> HTMLResponse:
    """
    Render the upload form.
    """
    context = {
        "request": request,
        "records_json": None,
        "srcip_options": [],
        "dstip_options": [],
        "dstport_options": [],
        "srcint_options": [],
        "dstint_options": [],
        "action_options": [],
        "error": None,
        "file_count": 0,
    }
    return templates.TemplateResponse("index.html", context)


@app.post("/", response_class=HTMLResponse)
async def upload_logs(
    request: Request, log_files: List[UploadFile] = File(...)
) -> HTMLResponse:
    """
    Accept uploaded log files, parse them, and render the interactive view.
    """
    try:
        records = load_logs(log_files)
    except UnicodeDecodeError:
        context = {
            "request": request,
            "records_json": None,
            "srcip_options": [],
            "dstip_options": [],
            "dstport_options": [],
            "srcint_options": [],
            "dstint_options": [],
            "action_options": [],
            "error": "Unable to decode the uploaded file(s). Ensure they are UTF-8 encoded.",
            "file_count": len(log_files),
        }
        return templates.TemplateResponse("index.html", context, status_code=400)

    if not records:
        context = {
            "request": request,
            "records_json": None,
            "srcip_options": [],
            "dstip_options": [],
            "dstport_options": [],
            "srcint_options": [],
            "dstint_options": [],
            "action_options": [],
            "error": "No valid log entries were found in the uploaded file(s).",
            "file_count": len(log_files),
        }
        return templates.TemplateResponse("index.html", context, status_code=400)

    # Prepare JSON strings for injection into the template.
    records_json = json.dumps(records, ensure_ascii=False)
    srcip_options = json.dumps(["All"] + unique_values(records, "srcip"), ensure_ascii=False)
    dstip_options = json.dumps(["All"] + unique_values(records, "dstip"), ensure_ascii=False)
    dstport_options = json.dumps(["All"] + unique_values(records, "dstport"), ensure_ascii=False)
    
    # Collect interface values (check both srcint/srcintf and dstint/dstintf)
    srcint_values = set()
    dstint_values = set()
    for record in records:
        if record.get("srcint"):
            srcint_values.add(record["srcint"])
        if record.get("srcintf"):
            srcint_values.add(record["srcintf"])
        if record.get("dstint"):
            dstint_values.add(record["dstint"])
        if record.get("dstintf"):
            dstint_values.add(record["dstintf"])
    
    srcint_options = json.dumps(["All"] + sorted(srcint_values), ensure_ascii=False)
    dstint_options = json.dumps(["All"] + sorted(dstint_values), ensure_ascii=False)
    action_options = json.dumps(["All"] + unique_values(records, "action"), ensure_ascii=False)

    context = {
        "request": request,
        "records_json": records_json,
        "srcip_options": srcip_options,
        "dstip_options": dstip_options,
        "dstport_options": dstport_options,
        "srcint_options": srcint_options,
        "dstint_options": dstint_options,
        "action_options": action_options,
        "error": None,
        "file_count": len(log_files),
    }
    return templates.TemplateResponse("index.html", context)

