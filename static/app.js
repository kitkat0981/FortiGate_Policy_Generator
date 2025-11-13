(() => {
  const recordsNode = document.getElementById("records-data");
  if (!recordsNode) {
    return;
  }

  const records = JSON.parse(recordsNode.textContent);
  const srcOptions = JSON.parse(document.getElementById("srcip-data").textContent);
  const dstOptions = JSON.parse(document.getElementById("dstip-data").textContent);
  const portOptions = JSON.parse(document.getElementById("dstport-data").textContent);
  const srcintOptions = JSON.parse(document.getElementById("srcint-data")?.textContent || '["All"]');
  const dstintOptions = JSON.parse(document.getElementById("dstint-data")?.textContent || '["All"]');
  const actionOptions = JSON.parse(document.getElementById("action-data")?.textContent || '["All"]');

  const srcSelect = document.getElementById("srcip-select");
  const dstSelect = document.getElementById("dstip-select");
  const portSelect = document.getElementById("dstport-select");
  const srcintSelect = document.getElementById("srcint-select");
  const dstintSelect = document.getElementById("dstint-select");
  const actionSelect = document.getElementById("action-select");
  const resultsBody = document.getElementById("results-body");
  const recordCountLabel = document.getElementById("record-count");
  const downloadCsvBtn = document.getElementById("download-csv-btn");
  const downloadPolicyBtn = document.getElementById("download-policy-btn");
  const rawLinesOutput = document.getElementById("raw-lines-output");
  const policyNameInput = document.getElementById("policy-name-input");
  const natSelect = document.getElementById("nat-select");
  const selectAllCheckbox = document.getElementById("select-all-checkbox");
  const selectedPolicyPanel = document.getElementById("selected-policy-panel");
  const panelOverlay = document.getElementById("panel-overlay");
  const closePanelBtn = document.getElementById("close-panel-btn");
  const selectedCountLabel = document.getElementById("selected-count");
  const selectedPolicyNameInput = document.getElementById("selected-policy-name-input");
  const selectedNatSelect = document.getElementById("selected-nat-select");
  const selectedSrcType = document.getElementById("selected-src-type");
  const selectedSrcCustom = document.getElementById("selected-src-custom");
  const selectedDstType = document.getElementById("selected-dst-type");
  const selectedDstCustom = document.getElementById("selected-dst-custom");

  let currentFiltered = [];
  let selectedRecords = new Set();

  const columnOrder = [
    "date",
    "time",
    "srcip",
    "dstip",
    "dstport",
    "service",
    "proto",
    "policyname",
    "action",
  ];

  function populateSelect(select, options) {
    select.innerHTML = "";
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function renderPlaceholder(message) {
    resultsBody.innerHTML = "";
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnOrder.length;
    cell.className = "placeholder";
    cell.textContent = message;
    row.appendChild(cell);
    resultsBody.appendChild(row);
  }

  function renderRawLines(data) {
    if (!rawLinesOutput) {
      return;
    }
    if (!data.length) {
      rawLinesOutput.value = "";
      return;
    }
    rawLinesOutput.value = data
      .map((record) => record.__raw_line || "")
      .filter(Boolean)
      .join("\n");
  }

  function renderTable(data) {
    resultsBody.innerHTML = "";
    selectedRecords.clear();
    updateSelectionUI();
    
    if (!data.length) {
      renderPlaceholder("No records match the selected filters.");
      return;
    }

    data.forEach((record, index) => {
      const row = document.createElement("tr");
      row.dataset.recordIndex = index;
      
      // Checkbox cell
      const checkboxCell = document.createElement("td");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "record-checkbox";
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedRecords.add(index);
        } else {
          selectedRecords.delete(index);
        }
        updateSelectionUI();
      });
      checkboxCell.appendChild(checkbox);
      row.appendChild(checkboxCell);
      
      // Data cells
      columnOrder.forEach((key) => {
        const cell = document.createElement("td");
        cell.textContent = record[key] ?? "";
        row.appendChild(cell);
      });
      resultsBody.appendChild(row);
    });
  }
  
  function showPanel() {
    const panel = document.getElementById("selected-policy-panel");
    const overlay = document.getElementById("panel-overlay");
    if (panel && overlay) {
      // Force a reflow to ensure the panel is ready
      panel.offsetHeight;
      panel.classList.add("active");
      overlay.classList.add("active");
      // Don't disable body scroll - allow users to scroll the main content
      // Update custom input visibility when panel is shown
      setTimeout(toggleCustomInputs, 50);
    } else {
      console.error("Panel elements not found", { panel, overlay });
    }
  }
  
  function hidePanel() {
    const panel = document.getElementById("selected-policy-panel");
    const overlay = document.getElementById("panel-overlay");
    if (panel && overlay) {
      panel.classList.remove("active");
      overlay.classList.remove("active");
    }
    // Don't clear selections when just closing the panel - user might want to reopen it
  }
  
  function updateSelectionUI() {
    const count = selectedRecords.size;
    const countLabel = document.getElementById("selected-count");
    if (countLabel) {
      countLabel.textContent = `${count} record${count !== 1 ? 's' : ''} selected`;
    }
    
    // Update selected records display
    updateSelectedRecordsDisplay();
    
    if (count > 0) {
      showPanel();
    } else {
      hidePanel();
    }
    
    // Update select all checkbox state
    if (selectAllCheckbox) {
      const allCheckboxes = document.querySelectorAll(".record-checkbox");
      if (allCheckboxes.length === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else {
        const checkedCount = document.querySelectorAll(".record-checkbox:checked").length;
        selectAllCheckbox.checked = checkedCount === allCheckboxes.length;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
      }
    }
  }
  
  function updateSelectedRecordsDisplay() {
    const recordsList = document.getElementById("selected-records-list");
    if (!recordsList) return;
    
    const selected = getSelectedRecords();
    
    if (selected.length === 0) {
      recordsList.innerHTML = "<p class='no-selection'>No records selected</p>";
      updateCustomServicesUI([]);
      return;
    }
    
    recordsList.innerHTML = selected.map((record, idx) => {
      const srcip = record.srcip || "N/A";
      const dstip = record.dstip || "N/A";
      const dstport = record.dstport || "N/A";
      return `
        <div class="selected-record-item">
          <div class="record-number">Record ${idx + 1}</div>
          <div class="record-details">
            <div class="record-detail-row">
              <span class="detail-label">Source IP:</span>
              <span class="detail-value">${srcip}</span>
            </div>
            <div class="record-detail-row">
              <span class="detail-label">Destination IP:</span>
              <span class="detail-value">${dstip}</span>
            </div>
            <div class="record-detail-row">
              <span class="detail-label">Destination Port:</span>
              <span class="detail-value">${dstport}</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
    
    // Check for unmapped services and show custom service UI
    checkAndDisplayCustomServices(selected);
  }
  
  function checkAndDisplayCustomServices(selectedData) {
    const fortigateServices = [
      "AFS3", "ALL", "AH", "ALL_ICMP", "ALL_TCP", "ALL_UDP", "AOL", "BGP", "CVSPSERVER", 
      "DCE-RPC", "DHCP", "DHCP6", "DNS", "ESP", "Exchange Server Email Access", "FINGER", 
      "FTP", "FTP_GET", "FTP_PUT", "GOPHER", "GRE", "GTP", "H323", "HTTP", "HTTPS", "IKE", 
      "IMAP", "IMAPS", "INFO_ADDRESS", "INFO_REQUEST", "Internet-Locator-Service", "IRC", 
      "KERBEROS", "L2TP", "LDAP", "LDAP_UDP", "MGCP", "MMS", "MS-SQL", "MYSQL", "NetMeeting", 
      "NFS", "NNTP", "NONE", "NTP", "ONC-RPC", "OSPF", "PC-Anywhere", "PING", "POP3", "POP3S", 
      "PPTP", "QUAKE", "RADIUS", "RADIUS-OLD", "RAUDIO", "RDP", "REXEC", "RIP", "RLOGIN", 
      "RSH", "RTSP", "SAMBA", "SCCP", "SIP", "SIP-MSNmessenger", "SMB", "SMTP", "SMTPS", 
      "SNMP", "SOCKS", "SQUID", "SSH", "SYSLOG", "TALK", "TELNET", "TFTP", "TIMESTAMP", 
      "TRACEROUTE", "UUCP", "VDOLIVE", "VNC", "WAIS", "Web Access", "Windows AD", "WINFRAME", 
      "WINS", "X-WINDOWS"
    ];
    
    const portServiceMap = {
      "tcp": {20: "FTP", 21: "FTP", 22: "SSH", 23: "TELNET", 25: "SMTP", 53: "DNS",
              80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 465: "SMTPS",
              587: "SMTP", 993: "IMAPS", 995: "POP3S", 1433: "MS-SQL", 3306: "MYSQL",
              3389: "RDP", 5900: "VNC", 8080: "HTTP"},
      "udp": {53: "DNS", 67: "DHCP", 68: "DHCP", 69: "TFTP", 123: "NTP", 161: "SNMP",
              162: "SNMP", 500: "IKE", 1812: "RADIUS", 1813: "RADIUS", 4500: "IKE"},
      "icmp": {"*": "ALL_ICMP"}
    };
    
    const unmappedServices = new Map();
    
    selectedData.forEach(record => {
      const port = record.dstport || "";
      const protocol = record.proto || "";
      const serviceName = record.service || "";
      
      // Check if service name matches FortiGate service
      if (serviceName) {
        const upperService = serviceName.toUpperCase().trim();
        if (fortigateServices.includes(upperService)) {
          return; // Already mapped
        }
      }
      
      // Check if port/protocol maps to a service
      const portNum = parseInt(port);
      if (!isNaN(portNum)) {
        const proto = protocol ? protocol.toLowerCase() : "tcp";
        if (portServiceMap[proto] && portServiceMap[proto][portNum]) {
          return; // Already mapped
        }
        if (proto === "icmp" || proto === "1") {
          return; // ICMP maps to ALL_ICMP
        }
      }
      
      // Service is not mapped - add to unmapped list
      if (port && port.trim()) {
        const proto = protocol ? protocol.toLowerCase() : "tcp";
        const key = `${proto}/${port}`;
        if (!unmappedServices.has(key)) {
          unmappedServices.set(key, {
            port: port.trim(),
            protocol: proto,
            originalService: serviceName
          });
        }
      }
    });
    
    updateCustomServicesUI(Array.from(unmappedServices.values()));
  }
  
  function updateCustomServicesUI(unmappedServices) {
    const customServicesSection = document.getElementById("custom-services-section");
    const customServicesList = document.getElementById("custom-services-list");
    
    if (!customServicesSection || !customServicesList) return;
    
    if (unmappedServices.length === 0) {
      customServicesSection.style.display = "none";
      return;
    }
    
    customServicesSection.style.display = "block";
    
    customServicesList.innerHTML = unmappedServices.map((service, idx) => {
      const serviceId = `custom-service-${idx}`;
      const defaultName = `CUSTOM_${service.protocol.toUpperCase()}_${service.port}`;
      return `
        <div class="custom-service-item" data-service-key="${service.protocol}/${service.port}">
          <div class="custom-service-header">
            <span class="service-port-info">${service.protocol.toUpperCase()}/${service.port}</span>
          </div>
          <div class="custom-service-fields">
            <div class="custom-service-field">
              <label>Service Name *</label>
              <input type="text" class="custom-service-name" data-service-id="${serviceId}" 
                     placeholder="${defaultName}" value="${defaultName}" required>
            </div>
            <div class="custom-service-field">
              <label>Protocol</label>
              <select class="custom-service-protocol" data-service-id="${serviceId}">
                <option value="tcp" ${service.protocol === "tcp" ? "selected" : ""}>TCP</option>
                <option value="udp" ${service.protocol === "udp" ? "selected" : ""}>UDP</option>
              </select>
            </div>
            <div class="custom-service-field">
              <label>Port Number *</label>
              <input type="number" class="custom-service-port" data-service-id="${serviceId}" 
                     value="${service.port}" required min="1" max="65535">
            </div>
          </div>
        </div>
      `;
    }).join("");
  }
  
  function getCustomServiceDefinitions(unmappedServices) {
    const customServices = [];
    const customServiceItems = document.querySelectorAll(".custom-service-item");
    
    customServiceItems.forEach(item => {
      const nameInput = item.querySelector(".custom-service-name");
      const protocolSelect = item.querySelector(".custom-service-protocol");
      const portInput = item.querySelector(".custom-service-port");
      
      if (nameInput && protocolSelect && portInput) {
        const name = nameInput.value.trim();
        const protocol = protocolSelect.value;
        const port = portInput.value.trim();
        
        if (name && port) {
          customServices.push({
            name: name,
            protocol: protocol,
            port: port
          });
        }
      }
    });
    
    return customServices;
  }

  function updateRecordCount(count, total) {
    recordCountLabel.textContent = `${count} / ${total} records`;
  }

  function clearFilters() {
    if (srcSelect) srcSelect.value = "All";
    if (dstSelect) dstSelect.value = "All";
    if (portSelect) portSelect.value = "All";
    if (srcintSelect) srcintSelect.value = "All";
    if (dstintSelect) dstintSelect.value = "All";
    if (actionSelect) actionSelect.value = "All";
    filterRecords();
  }

  function filterRecords() {
    const src = srcSelect.value;
    const dst = dstSelect.value;
    const port = portSelect.value;
    const srcint = srcintSelect?.value || "All";
    const dstint = dstintSelect?.value || "All";
    const action = actionSelect?.value || "All";

    const filtered = records.filter((record) => {
      const srcMatch = src === "All" || record.srcip === src;
      const dstMatch = dst === "All" || record.dstip === dst;
      const portMatch = port === "All" || record.dstport === port;
      const actionMatch = action === "All" || record.action === action;
      
      // Check interface fields (both srcint/srcintf and dstint/dstintf)
      const srcintMatch = srcint === "All" || 
        record.srcint === srcint || 
        record.srcintf === srcint;
      const dstintMatch = dstint === "All" || 
        record.dstint === dstint || 
        record.dstintf === dstint;
      
      return srcMatch && dstMatch && portMatch && srcintMatch && dstintMatch && actionMatch;
    });

    currentFiltered = filtered;
    selectedRecords.clear(); // Clear selection when filters change
    renderTable(filtered);
    renderRawLines(filtered);
    updateRecordCount(filtered.length, records.length);
    hidePanel(); // Hide panel when filters change
    return filtered;
  }

  function toCsv(data) {
    const header = columnOrder.join(",");
    const rows = data.map((record) =>
      columnOrder
        .map((key) => {
          const raw = record[key] ?? "";
          const value = String(raw);
          if (value.includes(",") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(",")
    );
    return [header, ...rows].join("\n");
  }

  function handleDownloadCsv() {
    const filtered = currentFiltered.length ? currentFiltered : filterRecords();
    if (!filtered.length) {
      alert("No records to download for the selected filters.");
      return;
    }

    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fortigate_filtered_logs.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function inferredPolicyName(record) {
    if (record.policyname) {
      return record.policyname;
    }
    const parts = [record.srcip, record.dstip, record.dstport].filter(Boolean);
    return parts.length ? parts.join(" → ") : "autogenerated-policy";
  }

  function toPolicyScript(data) {
    if (!data.length) {
      return "";
    }

    const policyNameOverride = policyNameInput?.value.trim();
    const natOverride = natSelect?.value || "disable";

    const entries = data.map((record) => {
      const name = policyNameOverride || inferredPolicyName(record);
      const srcInterface = record.srcintf || record.srcint || "port1";
      const dstInterface = record.dstintf || record.dstint || "port2";
      const srcAddress = record.srcaddr || record.srcip || "all";
      const dstAddress = record.dstaddr || record.dstip || "all";
      const natSetting = natOverride;

      return [
        "    edit 0",
        `        set name "${name}"`,
        `        set srcintf "${srcInterface}"`,
        `        set dstintf "${dstInterface}"`,
        "        set action accept",
        `        set srcaddr "${srcAddress}"`,
        `        set dstaddr "${dstAddress}"`,
        '        set schedule "always"',
        '        set service "ALL"',
        "        set logtraffic all",
        `        set nat ${natSetting}`,
        "    next",
      ].join("\n");
    });

    return ["config firewall policy", ...entries, "end"].join("\n");
  }

  function handleDownloadPolicy() {
    const filtered = currentFiltered.length ? currentFiltered : filterRecords();
    if (!filtered.length) {
      alert("No records to export for the selected filters.");
      return;
    }

    const script = toPolicyScript(filtered);
    const blob = new Blob([script], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fortigate_policy_script.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleSelectAll() {
    const allCheckboxes = document.querySelectorAll(".record-checkbox");
    const shouldSelect = selectAllCheckbox.checked;
    
    allCheckboxes.forEach((checkbox, index) => {
      checkbox.checked = shouldSelect;
      if (shouldSelect) {
        selectedRecords.add(index);
      } else {
        selectedRecords.delete(index);
      }
    });
    updateSelectionUI();
  }
  
  function handleClearSelection() {
    // Clear all selections
    selectedRecords.clear();
    document.querySelectorAll(".record-checkbox").forEach(cb => {
      cb.checked = false;
    });
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    }
    // Update UI and hide panel
    updateSelectedRecordsDisplay();
    hidePanel();
    // Update the count label
    const countLabel = document.getElementById("selected-count");
    if (countLabel) {
      countLabel.textContent = "0 records selected";
    }
    // Force update selection UI to ensure everything is cleared
    updateSelectionUI();
  }
  
  function getSelectedRecords() {
    return Array.from(selectedRecords)
      .map(index => currentFiltered[index])
      .filter(Boolean);
  }
  
  function toSinglePolicyScript(selectedData) {
    if (!selectedData.length) {
      return "";
    }
    
    // Query elements directly to ensure they exist
    const policyNameInput = document.getElementById("selected-policy-name-input");
    const natSelect = document.getElementById("selected-nat-select");
    const srcTypeSelect = document.getElementById("selected-src-type");
    const dstTypeSelect = document.getElementById("selected-dst-type");
    const srcCustomInput = document.getElementById("selected-src-custom");
    const dstCustomInput = document.getElementById("selected-dst-custom");
    
    if (!policyNameInput) {
      alert("Policy name input not found.");
      return null;
    }
    
    const policyName = policyNameInput.value.trim();
    if (!policyName) {
      alert("Please enter a policy name.");
      return null;
    }
    
    const natSetting = natSelect?.value || "disable";
    const srcType = srcTypeSelect?.value || "all";
    const dstType = dstTypeSelect?.value || "all";
    
    // Determine source address
    let srcAddress = "all";
    if (srcType === "selected") {
      const uniqueSrcIps = [...new Set(selectedData.map(r => r.srcip).filter(Boolean))];
      srcAddress = uniqueSrcIps.length > 0 ? uniqueSrcIps.join(" ") : "all";
    } else if (srcType === "custom") {
      srcAddress = srcCustomInput?.value.trim() || "all";
    }
    
    // Determine destination address
    let dstAddress = "all";
    if (dstType === "selected") {
      const uniqueDstIps = [...new Set(selectedData.map(r => r.dstip).filter(Boolean))];
      dstAddress = uniqueDstIps.length > 0 ? uniqueDstIps.join(" ") : "all";
    } else if (dstType === "custom") {
      dstAddress = dstCustomInput?.value.trim() || "all";
    }
    
    // Map ports/protocols to FortiGate 7.4 default service names
    // Reference: https://community.fortinet.com/t5/FortiGate/Technical-Tip-Default-Service-and-Service-Groups-and-count-in/ta-p/379582
    function mapToFortiGateService(port, protocol, serviceName) {
      // If service name already matches a FortiGate service, use it
      const fortigateServices = [
        "AFS3", "ALL", "AH", "ALL_ICMP", "ALL_TCP", "ALL_UDP", "AOL", "BGP", "CVSPSERVER", 
        "DCE-RPC", "DHCP", "DHCP6", "DNS", "ESP", "Exchange Server Email Access", "FINGER", 
        "FTP", "FTP_GET", "FTP_PUT", "GOPHER", "GRE", "GTP", "H323", "HTTP", "HTTPS", "IKE", 
        "IMAP", "IMAPS", "INFO_ADDRESS", "INFO_REQUEST", "Internet-Locator-Service", "IRC", 
        "KERBEROS", "L2TP", "LDAP", "LDAP_UDP", "MGCP", "MMS", "MS-SQL", "MYSQL", "NetMeeting", 
        "NFS", "NNTP", "NONE", "NTP", "ONC-RPC", "OSPF", "PC-Anywhere", "PING", "POP3", "POP3S", 
        "PPTP", "QUAKE", "RADIUS", "RADIUS-OLD", "RAUDIO", "RDP", "REXEC", "RIP", "RLOGIN", 
        "RSH", "RTSP", "SAMBA", "SCCP", "SIP", "SIP-MSNmessenger", "SMB", "SMTP", "SMTPS", 
        "SNMP", "SOCKS", "SQUID", "SSH", "SYSLOG", "TALK", "TELNET", "TFTP", "TIMESTAMP", 
        "TRACEROUTE", "UUCP", "VDOLIVE", "VNC", "WAIS", "Web Access", "Windows AD", "WINFRAME", 
        "WINS", "X-WINDOWS"
      ];
      
      if (serviceName) {
        const upperService = serviceName.toUpperCase().trim();
        // Check if service name matches a FortiGate service
        if (fortigateServices.includes(upperService)) {
          return upperService;
        }
      }
      
      // Map common ports to FortiGate services
      const portNum = parseInt(port);
      if (isNaN(portNum)) return null;
      
      const proto = protocol ? protocol.toLowerCase() : "tcp";
      
      // Port to service mapping based on FortiGate 7.4 defaults
      // Reference: https://community.fortinet.com/t5/FortiGate/Technical-Tip-Default-Service-and-Service-Groups-and-count-in/ta-p/379582
      const portServiceMap = {
        "tcp": {
          20: "FTP", 21: "FTP", 22: "SSH", 23: "TELNET", 25: "SMTP", 53: "DNS",
          80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 465: "SMTPS",
          587: "SMTP", 993: "IMAPS", 995: "POP3S", 1433: "MS-SQL", 3306: "MYSQL",
          3389: "RDP", 5900: "VNC", 8080: "HTTP"
        },
        "udp": {
          53: "DNS", 67: "DHCP", 68: "DHCP", 69: "TFTP", 123: "NTP", 161: "SNMP",
          162: "SNMP", 500: "IKE", 1812: "RADIUS", 1813: "RADIUS", 4500: "IKE"
        },
        "icmp": {
          "*": "ALL_ICMP"
        }
      };
      
      if (portServiceMap[proto] && portServiceMap[proto][portNum]) {
        return portServiceMap[proto][portNum];
      }
      
      // For ICMP, return ALL_ICMP
      if (proto === "icmp" || proto === "1") {
        return "ALL_ICMP";
      }
      
      // If no match, return null (will use ALL as fallback)
      return null;
    }
    
    // Extract service information from selected records
    // Track both mapped services and unmapped ports that need custom services
    const services = new Set();
    const unmappedServices = new Map(); // key: "proto/port", value: {port, protocol}
    
    selectedData.forEach(record => {
      const port = record.dstport || "";
      const protocol = record.proto || "";
      const serviceName = record.service || "";
      
      const fortigateService = mapToFortiGateService(port, protocol, serviceName);
      if (fortigateService) {
        services.add(fortigateService);
      } else if (port && port.trim()) {
        // Service not mapped - need custom service
        const proto = protocol ? protocol.toLowerCase() : "tcp";
        const key = `${proto}/${port}`;
        if (!unmappedServices.has(key)) {
          unmappedServices.set(key, {
            port: port.trim(),
            protocol: proto,
            originalService: serviceName
          });
        }
      }
    });
    
    // Check for custom service definitions
    const customServices = getCustomServiceDefinitions(unmappedServices);
    
    // Determine service value
    let serviceValue = '"ALL"';
    const allServices = new Set(services);
    customServices.forEach(cs => allServices.add(cs.name));
    
    if (allServices.size > 0) {
      // Format each service with double quotes
      serviceValue = Array.from(allServices).map(s => `"${s}"`).join(" ");
    }
    
    // Use first record for interface info, or defaults
    const firstRecord = selectedData[0];
    const srcInterface = firstRecord.srcintf || firstRecord.srcint || "port1";
    const dstInterface = firstRecord.dstintf || firstRecord.dstint || "port2";
    
    // Build custom service definitions if needed
    let customServiceDefs = "";
    if (customServices.length > 0) {
      const serviceEntries = customServices.map(cs => {
        const portField = cs.protocol === "tcp" ? "tcp-portrange" : "udp-portrange";
        return [
          `    edit "${cs.name}"`,
          `        set ${portField} ${cs.port}`,
          "    next"
        ].join("\n");
      });
      customServiceDefs = ["config firewall service custom", ...serviceEntries, "end"].join("\n") + "\n\n";
    }
    
    const policyEntry = [
      "    edit 0",
      `        set name "${policyName}"`,
      `        set srcintf "${srcInterface}"`,
      `        set dstintf "${dstInterface}"`,
      "        set action accept",
      `        set srcaddr "${srcAddress}"`,
      `        set dstaddr "${dstAddress}"`,
      '        set schedule "always"',
      `        set service ${serviceValue}`,
      "        set logtraffic all",
      `        set nat ${natSetting}`,
      "    next",
    ].join("\n");
    
    const policyConfig = ["config firewall policy", policyEntry, "end"].join("\n");
    
    return customServiceDefs + policyConfig;
  }
  
  function handleGeneratePolicy() {
    const selected = getSelectedRecords();
    if (!selected.length) {
      alert("Please select at least one record.");
      return;
    }
    
    // Validate custom services before generating
    const customServiceItems = document.querySelectorAll(".custom-service-item");
    let hasErrors = false;
    
    customServiceItems.forEach(item => {
      const nameInput = item.querySelector(".custom-service-name");
      const portInput = item.querySelector(".custom-service-port");
      
      if (nameInput && portInput) {
        const name = nameInput.value.trim();
        const port = portInput.value.trim();
        
        if (!name) {
          alert("Please enter a service name for all custom services.");
          hasErrors = true;
          return;
        }
        
        if (!port || isNaN(parseInt(port)) || parseInt(port) < 1 || parseInt(port) > 65535) {
          alert(`Invalid port number for service "${name}". Port must be between 1 and 65535.`);
          hasErrors = true;
          return;
        }
      }
    });
    
    if (hasErrors) {
      return;
    }
    
    const script = toSinglePolicyScript(selected);
    if (!script) {
      return;
    }
    
    const blob = new Blob([script], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fortigate_policy_script.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  
  // Show/hide custom input fields based on selection
  function toggleCustomInputs() {
    const srcTypeSelect = document.getElementById("selected-src-type");
    const dstTypeSelect = document.getElementById("selected-dst-type");
    const srcCustom = document.getElementById("selected-src-custom");
    const dstCustom = document.getElementById("selected-dst-custom");
    
    if (srcCustom && srcTypeSelect) {
      srcCustom.style.display = srcTypeSelect.value === "custom" ? "block" : "none";
    }
    if (dstCustom && dstTypeSelect) {
      dstCustom.style.display = dstTypeSelect.value === "custom" ? "block" : "none";
    }
  }

  populateSelect(srcSelect, srcOptions);
  populateSelect(dstSelect, dstOptions);
  populateSelect(portSelect, portOptions);
  if (srcintSelect) {
    populateSelect(srcintSelect, srcintOptions);
  }
  if (dstintSelect) {
    populateSelect(dstintSelect, dstintOptions);
  }
  if (actionSelect) {
    populateSelect(actionSelect, actionOptions);
  }

  srcSelect.addEventListener("change", filterRecords);
  dstSelect.addEventListener("change", filterRecords);
  portSelect.addEventListener("change", filterRecords);
  if (srcintSelect) {
    srcintSelect.addEventListener("change", filterRecords);
  }
  if (dstintSelect) {
    dstintSelect.addEventListener("change", filterRecords);
  }
  if (actionSelect) {
    actionSelect.addEventListener("change", filterRecords);
  }
  downloadCsvBtn.addEventListener("click", handleDownloadCsv);
  downloadPolicyBtn.addEventListener("click", handleDownloadPolicy);
  
  // Clear filters button
  const clearFiltersBtn = document.getElementById("clear-filters-btn");
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", clearFilters);
  }
  
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", handleSelectAll);
  }
  
  // Clear selection button in Results panel
  const clearSelectionBtn = document.getElementById("clear-selection-btn");
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener("click", handleClearSelection);
  }
  
  // Generate Policy button - use event delegation since panel might not be fully loaded
  // Set up listener on document to catch clicks even if button is added later
  document.addEventListener("click", (e) => {
    const button = e.target.closest("#generate-policy-btn");
    if (button) {
      e.preventDefault();
      e.stopPropagation();
      handleGeneratePolicy();
    }
  });
  // Set up custom input toggles - use event delegation for reliability
  document.addEventListener("change", (e) => {
    if (e.target && (e.target.id === "selected-src-type" || e.target.id === "selected-dst-type")) {
      toggleCustomInputs();
    }
  });
  
  // Also set up direct listeners if elements exist
  if (selectedSrcType) {
    selectedSrcType.addEventListener("change", toggleCustomInputs);
  }
  if (selectedDstType) {
    selectedDstType.addEventListener("change", toggleCustomInputs);
  }
  
  // Initialize custom input visibility on page load
  toggleCustomInputs();
  
  // Panel close handlers - query DOM directly to ensure elements exist
  const closeBtn = document.getElementById("close-panel-btn");
  const overlay = document.getElementById("panel-overlay");
  const panel = document.getElementById("selected-policy-panel");
  
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hidePanel();
    });
    // Also handle mousedown to ensure it works
    closeBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      // Only close if clicking directly on the overlay, not on content
      if (e.target === overlay) {
        hidePanel();
      }
    });
  }
  
  // Prevent panel from closing when clicking inside it
  if (panel) {
    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  filterRecords();
})();

