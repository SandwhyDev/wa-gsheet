import { DataPesan } from "./constant/data.js";

// Initialize variables
let currentPage = 1;
const rowsPerPage = 10;
let responseData = null;

// DOM elements
// LOGIN
const waLoginForm = document.getElementById("wa-login-form");
const waNumberInput = document.getElementById("wa-number");
const loginForm = document.getElementById("login-form");
const logoutBtn = document.getElementById("logoutBtn");
const codeLogin = document.getElementById("code-login");
const containerCode = document.getElementById("containerCode");

const tableBody = document.getElementById("table-body");
const containerDisbursement = document.getElementById("containerDisbursement");
const paginationInfo = document.getElementById("pagination-info");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const disbursementBtn = document.getElementById("disbursement-btn");
const loadingState = document.getElementById("loading-state");
const loadingFirst = document.getElementById("loading-first");
const dataState = document.getElementById("data-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");

// Display user information
const phoneNumber = document.getElementById("phone-number");
const platform = document.getElementById("platform");
const pushname = document.getElementById("pushname");

// Form handling script
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("disbursement-config-form");
  const resetBtn = document.getElementById("reset-config-btn");
  const processingStatus = document.getElementById("processing-status");
  const successStatus = document.getElementById("success-status");

  document.getElementById("message").value = DataPesan.message;
  document.getElementById("limit").value = DataPesan.limit;
  document.getElementById("batch_size").value = DataPesan.batch_size;
  document.getElementById("msg_delay_min").value =
    DataPesan.delay_between_messages.min;
  document.getElementById("msg_delay_max").value =
    DataPesan.delay_between_messages.max;
  document.getElementById("batch_delay_min").value =
    DataPesan.delay_between_batches.min;
  document.getElementById("batch_delay_max").value =
    DataPesan.delay_between_batches.max;

  // Reset form to defaults
  resetBtn.addEventListener("click", function () {
    document.getElementById("message").value = "";
    document.getElementById("limit").value = "";
    document.getElementById("batch_size").value = "20";
    document.getElementById("msg_delay_min").value = "1";
    document.getElementById("msg_delay_max").value = "3";
    document.getElementById("batch_delay_min").value = "10";
    document.getElementById("batch_delay_max").value = "15";
  });

  // Form validation
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Validate delay ranges
    const msgDelayMin = parseInt(
      document.getElementById("msg_delay_min").value
    );
    const msgDelayMax = parseInt(
      document.getElementById("msg_delay_max").value
    );
    const batchDelayMin = parseInt(
      document.getElementById("batch_delay_min").value
    );
    const batchDelayMax = parseInt(
      document.getElementById("batch_delay_max").value
    );

    if (msgDelayMin >= msgDelayMax) {
      alert("Message delay minimum must be less than maximum");
      return;
    }

    if (batchDelayMin >= batchDelayMax) {
      alert("Batch delay minimum must be less than maximum");
      return;
    }

    // Collect form data
    const formData = {
      message: document.getElementById("message").value.trim() || undefined,
      limit: document.getElementById("limit").value
        ? parseInt(document.getElementById("limit").value)
        : undefined,
      batch_size: parseInt(document.getElementById("batch_size").value),
      delay_between_messages: {
        min: msgDelayMin,
        max: msgDelayMax,
      },
      delay_between_batches: {
        min: batchDelayMin,
        max: batchDelayMax,
      },
    };

    // Remove undefined values
    Object.keys(formData).forEach((key) => {
      if (formData[key] === undefined) {
        delete formData[key];
      }
    });

    // Show processing status
    processingStatus.classList.remove("hidden");
    successStatus.classList.add("hidden");

    const processingDetails = document.getElementById("processing-details");
    processingDetails.textContent = `Batch size: ${formData.batch_size}, Message delay: ${formData.delay_between_messages.min}-${formData.delay_between_messages.max}min, Batch delay: ${formData.delay_between_batches.min}-${formData.delay_between_batches.max}min`;

    // Send request to API
    fetch("/api/send-message/disbursement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    })
      .then((response) => response.json())
      .then((data) => {
        processingStatus.classList.add("hidden");

        if (data.success) {
          successStatus.classList.remove("hidden");
          const successDetails = document.getElementById("success-details");
          successDetails.textContent = `Configuration: ${
            data.configuration.total_data
          } total records, ${
            data.configuration.limit_recipients || "no"
          } limit, ${data.configuration.estimated_batches} estimated batches`;
        } else {
          alert("Error: " + data.error);
        }
      })
      .catch((error) => {
        processingStatus.classList.add("hidden");
        alert("Network error: " + error.message);
      });
  });
});

// Function to fetch data from API
async function fetchData() {
  try {
    // Show loading state
    loadingState.classList.remove("hidden");
    dataState.classList.add("hidden");
    errorState.classList.add("hidden");

    const response = await fetch("http://localhost:8000/api/info", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Add any required headers here
        // 'Authorization': 'Bearer your-token'
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    responseData = await response.json();

    // Display user information
    phoneNumber.textContent = responseData.message.phone.number;
    platform.textContent = responseData.message.phone.platform;
    pushname.textContent = responseData.message.pushname;

    // Hide loading and show data
    loadingState.classList.add("hidden");
    dataState.classList.remove("hidden");

    // Render table
    renderTableRows();
  } catch (error) {
    loginForm.classList.remove("hidden");
    loginForm.classList.add(
      "flex",
      "flex-col",
      "items-center",
      "justify-center"
    );
    containerDisbursement.classList.add("hidden");
    console.error("Error fetching data:", error);
    errorMessage.textContent = `Error fetching data: ${error.message}`;
    loadingState.classList.add("hidden");
    errorState.classList.remove("hidden");

    // Display user information
    phoneNumber.textContent = "error";
    platform.textContent = "error";
    pushname.textContent = "error";
  }
}

// Handle login form submission
waLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phoneNumber = waNumberInput.value.trim();

  if (!phoneNumber) {
    alert("Please enter a valid WhatsApp number");
    return;
  }

  try {
    // Show loading state
    const submitButton = waLoginForm.querySelector("button");
    submitButton.disabled = true;
    submitButton.textContent = "Logging in...";

    // Here you would typically send the phone number to your backend
    // Example API call:
    const response = await fetch("http://localhost:8000/api/init-wa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nomor: phoneNumber }),
    });

    if (!response.ok) {
      throw new Error("Login failed");
    }

    const result = await response.json();

    if (result.success && result.message.data.message) {
      codeLogin.textContent = `${result.message.data.message}`;
      waLoginForm.classList.add("hidden");
      containerCode.classList.remove("hidden");
    }

    // If login successful, hide form and fetch data again
    setTimeout(() => {
      loginForm.classList.add("hidden");
      containerDisbursement.classList.remove("hidden");

      fetchData();
    }, 5000);
  } catch (error) {
    console.error("Login error:", error);
    alert("Login failed. Please try again.");
  } finally {
    const submitButton = waLoginForm.querySelector("button");
    submitButton.disabled = false;
    submitButton.textContent = "Login";
  }
});

// Handle logout
logoutBtn.addEventListener("click", async function () {
  try {
    let yakin = confirm("Yakin ini Keluar ?");

    if (!yakin) {
      return;
    }

    loadingFirst.classList.remove("hidden");

    const response = await fetch("http://localhost:8000/api/logout", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Tambahkan header authorization jika diperlukan
        // 'Authorization': 'Bearer ' + token
      },
      credentials: "include", // Jika menggunakan cookies
    });

    if (response.ok) {
      // Redirect ke halaman login atau refresh halaman setelah logout
      window.location.reload();
    } else {
      console.error("Logout failed");
    }
  } catch (error) {
    console.error("Error during logout:", error);
  }
});

// Function to render table rows
function renderTableRows() {
  if (!responseData || !responseData.data) return;

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const paginatedData = responseData.data.slice(startIndex, endIndex);

  tableBody.innerHTML = "";

  paginatedData.forEach((item, index) => {
    const row = document.createElement("tr");
    row.className = index % 2 === 0 ? "bg-white" : "bg-gray-50";

    const statusColor =
      item.status === "Terkirim"
        ? "text-green-600"
        : item.status === "Pending"
        ? "text-yellow-600"
        : "text-red-600";

    row.innerHTML = `
    <td class="py-3 px-4 font-normal">${startIndex + index + 1}</td>
    <td class="py-3 px-4 font-normal">${item.nama || ""}</td>
    <td class="py-3 px-4 font-normal">${item.no_hp || ""}</td>
    <td class="py-3 px-4 font-normal">${item.kelas || ""}</td>
    <td class="py-3 px-4 font-normal">
        ${
          item.link_qr
            ? `<a href="${item.link_qr}" target="_blank" class="text-blue-600 hover:underline">View QR</a>`
            : ""
        }
    </td>
    <td class="py-3 px-4 font-normal ${statusColor}">${
      !item.status ? "" : item.status
    }</td>
`;

    tableBody.appendChild(row);
  });

  // Update pagination info
  const totalRows = responseData.data.length;
  const startRow = startIndex + 1;
  const endRow = Math.min(endIndex, totalRows);

  paginationInfo.textContent = `Showing ${startRow} to ${endRow} of ${totalRows} entries`;

  // Update button states
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = endIndex >= totalRows;
}

// Event listeners for pagination
prevBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderTableRows();
  }
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(responseData.data.length / rowsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderTableRows();
  }
});

// Event listener for disbursement button
disbursementBtn.addEventListener("click", async () => {
  if (!responseData) return;

  try {
    // Disable button and show processing state
    disbursementBtn.disabled = true;
    disbursementBtn.textContent = "Processing...";
    disbursementBtn.classList.remove("bg-green-600", "hover:bg-green-700");
    disbursementBtn.classList.add("bg-gray-400");

    // Validate delay ranges
    const msgDelayMin = parseInt(
      document.getElementById("msg_delay_min").value
    );
    const msgDelayMax = parseInt(
      document.getElementById("msg_delay_max").value
    );
    const batchDelayMin = parseInt(
      document.getElementById("batch_delay_min").value
    );
    const batchDelayMax = parseInt(
      document.getElementById("batch_delay_max").value
    );

    if (msgDelayMin >= msgDelayMax) {
      alert("Message delay minimum must be less than maximum");
      return;
    }

    if (batchDelayMin >= batchDelayMax) {
      alert("Batch delay minimum must be less than maximum");
      return;
    }

    // Collect form data
    const formData = {
      message: document.getElementById("message").value.trim() || undefined,
      limit: document.getElementById("limit").value
        ? parseInt(document.getElementById("limit").value)
        : undefined,
      batch_size: parseInt(document.getElementById("batch_size").value),
      delay_between_messages: {
        min: msgDelayMin,
        max: msgDelayMax,
      },
      delay_between_batches: {
        min: batchDelayMin,
        max: batchDelayMax,
      },
    };

    // Remove undefined values
    Object.keys(formData).forEach((key) => {
      if (formData[key] === undefined) {
        delete formData[key];
      }
    });

    // Make API call to disbursement endpoint
    const response = await fetch(`${window.location.origin}/api/disbursement`, {
      method: "POST", // Assuming this is a POST endpoint
      headers: {
        "Content-Type": "application/json",
        // Add any required headers here (e.g., authorization)
        // 'Authorization': 'Bearer your-token'
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    // Show success message
    alert(`Disbursement successful! ${result.message || ""}`);

    // Optional: Refresh the data after successful disbursement
    // fetchData();
  } catch (error) {
    console.error("Disbursement failed:", error);
    alert(`Disbursement failed: ${error.message}`);
  } finally {
    // Reset button state
    disbursementBtn.disabled = false;
    disbursementBtn.textContent = "Process Disbursement";
    disbursementBtn.classList.remove("bg-gray-400");
    disbursementBtn.classList.add("bg-green-600", "hover:bg-green-700");
  }
});

// Initial data fetch
fetchData();
