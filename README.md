# FortiGate Policy Generator

FastAPI-based web application for uploading raw FortiGate traffic logs, filtering them by source IP, destination IP, destination port, and action, and generating FortiGate firewall policy scripts from selected records.

## Features

- Upload one or multiple FortiGate raw log files (key=value format)
- Automatic parsing of core fields: `srcip`, `dstip`, `dstport`, and more
- Browser-side filtering with dropdown selectors
- Pageless UI built with vanilla JavaScript + Jinja templates
- CSV export of filtered records
- Instant view of the original log lines that match the filters
- **Record Selection**: Select specific records from filtered results using checkboxes
- **Single Policy Builder**: Create one aggregated FortiGate firewall policy from selected records with:
  - Custom policy name
  - Configurable source address (ALL, from selected IPs, or custom subnet)
  - Configurable destination address (ALL, from selected IPs, or custom subnet)
  - NAT enable/disable option
- **Bulk Export**: Export all filtered records as individual policies (one policy per record)
- Ready for containerized deployment with Docker

## Local Development

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

Then browse to <http://127.0.0.1:8000>.

## Docker Usage

```bash
docker build -t fortigate-policy-generator .
docker run -d --rm -p 8000:8000 --name fortigate-policy-generator fortigate-policy-generator
```

Access the application at <http://localhost:8000>. Use `0.0.0.0` instead of `localhost` if the container runs on a remote host.

## Usage

### Filtering and Selection

1. Upload one or more FortiGate log files
2. Use the filter dropdowns to narrow down results by Source IP, Destination IP, and Destination Port
3. Select specific records using the checkboxes in the table (or use "Select All" in the header)
4. The "Create Policy from Selected Records" panel appears when records are selected

### Creating a Single Policy from Selected Records

1. Select the records you want to include in the policy
2. In the "Create Policy from Selected Records" panel:
   - Enter a **Policy Name** (required)
   - Choose **NAT** setting (enable/disable)
   - Configure **Source Address**:
     - `ALL`: Allow all source addresses
     - `From Selected IPs`: Use unique source IPs from selected records
     - `Custom Subnet`: Enter a custom subnet (e.g., `192.168.1.0/24`)
   - Configure **Destination Address** (same options as Source)
3. Click "Generate Policy Script" to download the FortiGate configuration

### Bulk Export

Use the "Bulk Export Settings" panel to export all filtered records as individual policies. Each record becomes a separate policy entry with optional name override and NAT setting.

## Notes

- The parser expects FortiGate log lines similar to:
  ```
  date=2025-11-12 time=10:17:48 ... srcip=10.10.3.4 ... dstip=10.2.0.100 ... dstport=443 ...
  ```
- For protocols without a destination port (e.g., ICMP), the `Destination Port` dropdown may show empty values.
- Filtering happens entirely in the browser, so large uploads may impact client performance.
- When selecting "From Selected IPs", unique IPs from all selected records are aggregated and space-separated in the policy.
- Changing filters clears the current selection.

