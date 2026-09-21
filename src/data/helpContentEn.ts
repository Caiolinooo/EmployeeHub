import { HelpCategory } from './helpContent';

export const helpCategoriesEn: HelpCategory[] = [
    // ==========================================
    // CATEGORY: ABZ PORTAL
    // ==========================================
    {
        id: 'onboarding',
        name: 'Onboarding',
        description: 'First steps in the ABZ Portal',
        icon: 'FiLogIn',
        articles: [
            {
                id: 'o-que-e-portal',
                title: 'What is the ABZ Portal?',
                content: `
## What is the ABZ Portal?

The **ABZ Portal** is an exclusive information center for ABZ Group employees.

### What you will find on the portal:

- 📋 **Procedures** - Operational manuals and guides
- 📜 **Policies** - Company rules and regulations
- 📅 **Calendar** - Events and important dates
- 📰 **ABZ News** - News and announcements
- 💰 **Reimbursements** - Request and tracking
- 🎓 **Academy** - Training and courses
- 📊 **Evaluation** - Performance and feedback

### Access

Access via the link: **https://portal.groupabz.com**
        `,
                category: 'onboarding',
                keywords: ['portal', 'abz', 'what is', 'home', 'about']
            },
            {
                id: 'instalar-app',
                title: 'How to download the ABZ Portal App?',
                content: `
## Installing the ABZ Portal App

The ABZ Portal can be installed as an app on your computer or phone for quick access.

### Step-by-step:

1. **Access the portal** via your browser:
   - Link: \`https://portal.groupabz.com/dashboard\`

2. **Click on the install icon**:
   - On Chrome/Edge: click the **"Install application"** icon in the address bar (next to the search icon)

3. **Confirm the installation**:
   - Click **"Install"**
   - Check **"Pin to taskbar"** (optional)
   - Click **"Allow"**

4. **Done!**
   - The app will appear in your start menu and/or desktop

### Tip

For mobile, access the portal via the Chrome browser and use the "Add to Home Screen" option.
        `,
                category: 'onboarding',
                keywords: ['app', 'install', 'download', 'application', 'pwa'],
                images: [
                    '/images/help/instalar-app-1.png',
                    '/images/help/instalar-app-2.png',
                    '/images/help/instalar-app-3.png'
                ]
            },
            {
                id: 'mudar-senha',
                title: 'How to change the initial password?',
                content: `
## Changing your Password

For enhanced security, we recommend changing your initial password.

### Step-by-step:

1. **Click on your profile** (bottom left corner of the screen)

2. **Scroll down until you find "Change Password"**

3. **Fill in the fields**:
   - Current password
   - New password (minimum 8 characters)
   - Confirm new password

4. **Click "Change Password"**

### Password requirements:

- ✅ Minimum of **8 characters**
- ✅ Recommended: letters, numbers, and symbols

### Forgot your password?

Use the **"Forgot my password"** option on the login screen to receive a recovery email.
        `,
                category: 'onboarding',
                keywords: ['password', 'change', 'update', 'recover'],
                images: [
                    '/images/help/alterar-senha.png'
                ]
            },
            {
                id: 'reportar-erros',
                title: 'How to report errors?',
                content: `
## Reporting Errors on the Portal

Found a problem? Help us improve the portal by reporting the error.

### Step-by-step:

1. **Click the Help button** (question mark icon in the bottom right corner)

2. **Access the "Messages" tab**

3. **Select "Report an error/bug"**

4. **Describe the problem**:
   - What you were trying to do
   - What went wrong
   - What the expected behavior was

5. **Optionally**:
   - Use **"Capture Screen"** to take a screenshot
   - Attach files if necessary

6. **Click "Send"**

### Data sent automatically:

- Current page URL
- Browser information
- Console errors (if any)
        `,
                category: 'onboarding',
                keywords: ['error', 'bug', 'problem', 'report', 'help'],
                images: [
                    '/images/help/reportar-erro.png'
                ]
            }
        ]
    },
    {
        id: 'reembolso',
        name: 'Reimbursement',
        description: 'Reimbursement requests and tracking',
        icon: 'FiDollarSign',
        articles: [
            {
                id: 'preencher-formulario',
                title: 'How to fill out the reimbursement form?',
                content: `
## Filling out the Reimbursement Form

Follow the steps below to correctly request your reimbursement.

### Step-by-step:

1. **Access the "Reimbursement" card** on the dashboard

2. **Check your personal data**:
   - Name, email, phone
   - Correct if necessary

3. **Enter your CPF (ID)** (mandatory)

4. **Add expenses**:
   - Click **"Add Expense"**
   - Select the **type** (food, transport, etc.)
   - Enter the expense **date**
   - Enter the **amount**
   - Add a **justification**
   - **Attach the receipt** (photo of the invoice)

5. **Add more expenses if necessary**
   - You can include multiple expenses in a single request

6. **Choose the payment method**:
   - **Bank deposit**: enter bank, branch, and account details
   - **PIX**: enter PIX key type and key

7. **Review and send**:
   - Click **"Send Request"**

### Important:

- Attach legible receipts (invoice or receipt)
- The requested amount must exactly match the receipt
        `,
                category: 'reimbursement',
                keywords: ['reimbursement', 'form', 'fill', 'expense', 'request'],
                images: [
                    '/images/help/reembolso-formulario.png',
                    '/images/help/reembolso-adicionar.png'
                ]
            },
            {
                id: 'verificar-status',
                title: 'How to check my reimbursement status?',
                content: `
## Checking Reimbursement Status

Track the progress of your reimbursement request.

### Step-by-step:

1. **Access the "Reimbursement" card** on the dashboard

2. **Click the "My Reimbursements" tab**

3. **View your requests**:
   - Each row shows a request
   - Check the **"Status"** column

### Status meanings:

- 🟡 **Pending** - Awaiting manager analysis
- 🔵 **Under Review** - Being reviewed
- 🟢 **Approved** - Approved, awaiting payment
- ✅ **Paid** - Amount deposited in your account
- 🔴 **Rejected** - Not approved (see reason)

### Notifications:

- You will receive an email upon every status change
- Also check your spam folder
        `,
                category: 'reimbursement',
                keywords: ['status', 'track', 'check', 'approved', 'paid', 'pending'],
                images: [
                    '/images/help/reembolso-status.png'
                ]
            }
        ]
    },
    {
        id: 'contracheque',
        name: 'Pay Stub',
        description: 'Access to pay stubs and receipts',
        icon: 'FiFileText',
        articles: [
            {
                id: 'acessar-contracheque',
                title: 'How to access my pay stub?',
                content: `
## Accessing the Pay Stub

The pay stub is available through the WK Radar system.

### Step-by-step:

1. **Go to the link**:
   - \`http://wk.groupabz.com/radarwebnet\`

2. **Select** the option **"Employee Portal"**

3. **Log in**:
   - **User**: Your CPF (numbers only)
   - **Password**: \`1\` (for first access)

4. **Click "Receipt"**

5. **Log in again** (system prompt)

6. **View or print** your pay stub

### First access:

- The initial password is **"1"**
- We recommend changing the password after the first access

### Access problems?

- Ensure the CPF is correct (no dots or dashes)
- Contact HR if the problem persists
        `,
                category: 'pay-stub',
                keywords: ['pay stub', 'receipt', 'salary', 'wk', 'radar']
            }
        ]
    },
    {
        id: 'rede-publica',
        name: 'Public Network (Z: Drive)',
        description: 'Access to shared files and documents',
        icon: 'FiMonitor',
        articles: [
            {
                id: 'o-que-e-drive-z',
                title: 'What is the Public Network (Z: Drive)?',
                content: `
## Public Network - Z: Drive

The **Z: Drive** is the internal file server for ABZ Group.

### How to access:

1. **Open Windows File Explorer**

2. **Navigate to "This PC"**

3. **Look for "Data-ABZ (Z:)"**

4. **Double-click** to open

### Folder structure:

- \`Z:\\1. Publico\` - Company public documents
- \`Z:\\1. Publico\\3. Modelos diversos\` - Editable templates
- \`Z:\\1. Publico\\4. Comunicação\` - Logos and visual identity

### Important:

- Never save personal files on the public network
- Always create a **copy** before editing a template
        `,
                category: 'public-network',
                keywords: ['drive', 'z', 'network', 'public', 'files', 'server'],
                images: [
                    '/images/help/rede-local.png',
                    '/images/help/rede-pastas.png',
                    '/images/help/rede-endereco.png'
                ]
            },
            {
                id: 'modelos-editaveis',
                title: 'Where can I find editable templates?',
                content: `
## Editable Templates

Standard company document templates are available on the network.

### Location:

\`Z:\\1. Publico\\3. Modelos diversos\`

### What you will find:

- Presentation templates
- Document templates
- Standard email signatures
- Other standard formats

### How to use:

1. **Navigate to the folder** above
2. **Find the desired template**
3. **Copy the file** to your machine or another folder
4. **Edit the copy** (never the original!)

> ⚠️ **Important**: Always create a copy before editing. Do not modify the original files on the network.
        `,
                category: 'public-network',
                keywords: ['model', 'template', 'editable', 'document', 'standard'],
                images: [
                    '/images/help/rede-modelos.png'
                ]
            },
            {
                id: 'logotipo-identidade',
                title: 'Where can I find the logo and visual identity?',
                content: `
## Logo and Visual Identity

Official ABZ Group brand materials.

### Location:

\`Z:\\1. Publico\\4. Comunicação\`

### What you will find:

- 🎨 **Logos** in various formats (PNG, JPG, PDF)
- 🔤 Official company **Fonts**
- 🎯 **Icons** and graphic elements
- 📖 **Brand Manual** - Guide for using the visual identity

### Tips:

- Always use the most recent versions of the logos
- Check the brand manual for correct usage
- If in doubt, contact the Communications team
        `,
                category: 'public-network',
                keywords: ['logo', 'brand', 'identity', 'visual', 'communications'],
                images: [
                    '/images/help/rede-comunicacao.png'
                ]
            }
        ]
    },
    {
        id: 'email',
        name: 'Email (Signature)',
        description: 'Email signature configuration',
        icon: 'FiFileText',
        articles: [
            {
                id: 'assinatura-outlook-classico',
                title: 'How to add a signature in Classic Outlook?',
                content: `
## Email Signature - Classic Outlook

Configure your standard ABZ Group signature.

### Step 1: Copy the template

1. Go to: \`Z:\\1. Publico\\3. Modelos diversos\`
2. Open the file: **"Assinatura de E-mail Padrão.docx"**
3. Select all content (Ctrl+A)
4. Copy (Ctrl+C)

### Step 2: Configure in Outlook

1. Open **Outlook**
2. Go to **File** > **Options** > **Mail** > **Signatures**
3. Click **"New"**
4. Give it a name (e.g., "Standard ABZ")
5. Paste the signature (Ctrl+V) into the editing area
6. **Update your details**:
   - Your name
   - Your function/role
   - Your WhatsApp (if applicable)

### Step 3: Set as default

1. Under "Choose default signature":
   - **New messages**: Select your signature
   - **Replies/forwards**: Select your signature
2. Click **OK**
        `,
                category: 'email',
                keywords: ['signature', 'email', 'outlook', 'classic', 'configure'],
                images: [
                    '/images/help/outlook-menu.png',
                    '/images/help/outlook-opcoes.png',
                    '/images/help/outlook-assinatura.png'
                ]
            },
            {
                id: 'assinatura-novo-outlook',
                title: 'How to add a signature in New Outlook?',
                content: `
## Email Signature - New Outlook

Configure your signature in the new Outlook (web/modern version).

### Step 1: Copy the template

1. Go to: \`Z:\\1. Publico\\3. Modelos diversos\`
2. Open: **"Assinatura de E-mail Padrão.docx"**
3. Select all (Ctrl+A) and copy (Ctrl+C)

### Step 2: Configure in New Outlook

1. Click the **gear icon** (Settings) in the top right corner
2. Go to **Mail** > **Compose and reply**
3. Scroll down to **"Email signature"**
4. Click **"New signature"**
5. Give it a name (e.g., "ABZ")
6. Paste the signature (Ctrl+V)
7. **Update your details**:
   - Name
   - Role
   - WhatsApp

### Step 3: Enable

1. Check the option **"Automatically include my signature on new messages I compose"**
2. Check **"Automatically include my signature on messages I forward or reply to"**
3. Click **Save**
        `,
                category: 'email',
                keywords: ['signature', 'email', 'outlook', 'new', 'web', 'configure'],
                images: [
                    '/images/help/novo-outlook-config.png',
                    '/images/help/novo-outlook-assinatura.png',
                    '/images/help/novo-outlook-salvar.png'
                ]
            }
        ]
    },
    {
        id: 'teams',
        name: 'Teams',
        description: 'Microsoft Teams Configuration',
        icon: 'FiMessageSquare',
        articles: [
            {
                id: 'fundo-reunioes',
                title: 'How to add a background for meetings?',
                content: `
## Meeting Backgrounds in Teams

Customize the background of your video calls.

### Where to find ABZ backgrounds:

Official ABZ backgrounds are at:
\`Z:\\1. Publico\\4. Comunicação\\Perfis e Capas\`

### During a meeting:

1. Click **"More actions"** (three dots)
2. Select **"Video effects and settings"** or **"Apply background effects"**
3. Choose an option:
   - **Blur** - Blurs the background
   - **Standard image** - Select one of the Teams images
   - **Add new** - Upload your own image

### Before a meeting:

1. When joining a meeting, before clicking "Join now"
2. Turn on your camera
3. Click **"Background filters"**
4. Choose or upload an image

### Tip:

Download backgrounds from the network folder to your computer before using them in Teams.
        `,
                category: 'teams',
                keywords: ['teams', 'background', 'meeting', 'video']
            },
            {
                id: 'foto-perfil-teams',
                title: 'How to change the profile picture in Teams?',
                content: `
## Changing Profile Picture in Teams

Update your profile picture for easier identification.

### Step-by-step:

1. **Open Teams**

2. **Click your picture/initials** (top right corner)

3. **Click the picture again** or **"Change picture"**

4. **Choose an option**:
   - **Upload picture** - Select an image from your computer
   - **Take picture** - Use webcam to take a new picture

5. **Adjust the framing** (if necessary)

6. **Click "Save"**

### Picture tips:

- Use a professional photo
- Neutral background is preferred
- Face centered and clearly visible
- Good lighting
        `,
                category: 'teams',
                keywords: ['teams', 'picture', 'profile', 'avatar', 'image']
            }
        ]
    },

    // ==========================================
    // CATEGORY: R&S INDICATORS
    // ==========================================
    {
        id: 'indicadores-rs',
        name: 'R&S Indicators',
        description: 'Recruitment & Selection spreadsheets: import, row editing and effectiveness KPIs',
        icon: 'FiBarChart2',
        articles: [
            {
                id: 'rs-visao-geral',
                title: 'What is the R&S Indicators module?',
                content: `
## What is the R&S Indicators module?

The **R&S Indicators** module centralizes the Recruitment & Selection job spreadsheets and turns that data into performance indicators for the client service process.

### Where to find it:

1. Open the **Department** menu
2. Click **"R&S Indicators"**

### What you can do:

- 📥 **Import spreadsheets** - Upload XLSX files with R&S job data
- 🗂️ **Manage datasets** - Each import creates a spreadsheet (dataset) divided into tabs
- ✏️ **Edit rows** - Fix, add or remove records directly in the grid
- 📊 **KPIs & Assessment** - Track service effectiveness and see the process verdict

### Who has access:

Access is controlled by permissions:

- 👁️ **indicadores.view** - View spreadsheets and data
- ✏️ **indicadores.edit** - Edit tab rows
- 📥 **indicadores.import** - Import and replace spreadsheets
- ⚙️ **indicadores.admin** - Module administration

### Tip:

R&S teams with the module enabled automatically see the entry in the Department menu.
        `,
                category: 'indicadores-rs',
                keywords: ['indicators', 'r&s', 'recruitment', 'selection', 'jobs', 'module', 'kpi']
            },
            {
                id: 'rs-importar-planilha',
                title: 'How to import a spreadsheet?',
                content: `
## Importing a Spreadsheet

Imports run through a **3-step** wizard starting from an Excel file.

### Prerequisite:

- **indicadores.import** permission

### Step-by-step:

1. **Click "Import spreadsheet"** in the page header

2. **Step 1 - File**:
   - Select the **.xlsx** or **.xls** file from your computer
   - Click **"Analyze"** so the system can read the file

3. **Step 2 - Tab review**:
   - Check the preview of each file tab
   - Adjust the **header row** if the table does not start on the first line
   - **Select** only the tabs you want to import

4. **Step 3 - Confirmation**:
   - Set the **dataset name** (how the spreadsheet appears on the page)
   - Choose the **import mode**:
     - **Create new spreadsheet** - Generates a new dataset
     - **Replace existing spreadsheet** - Updates a dataset that was already imported

### Key concepts:

- 📁 **Dataset (spreadsheet)** - The imported set, shown as a card on the page
- 📑 **Tabs** - The Excel file sheets, imported inside the dataset
- 📃 **Rows** - The records (jobs, replacements, retention) in each tab

### Reimport or delete:

- Use **"Reimport"** on the dataset card to refresh the data (replace mode, keeping the name)
- Use **"Delete"** on the card to remove the dataset and all of its tabs (cannot be undone)
        `,
                category: 'indicadores-rs',
                keywords: ['import', 'spreadsheet', 'xlsx', 'xls', 'dataset', 'tab', 'wizard', 'reimport', 'delete']
            },
            {
                id: 'rs-editar-linhas',
                title: 'How to edit rows in a tab?',
                content: `
## Editing Rows in a Tab

Each tab's data is edited in a grid, directly in the portal — no need to download the file again.

### Prerequisite:

- **indicadores.edit** permission

### Step-by-step:

1. **Open the tab** through the dataset chip on the corresponding card

2. **Find records**:
   - Use **search** to filter by any value
   - Click column titles to **sort**

3. **Add a row**:
   - Click **"New row"**
   - Fill in the fields and save

4. **Edit a row**:
   - Click the row (or the edit icon)
   - Adjust the values and save

5. **Delete a row**:
   - Click the delete icon and confirm
   - Deletion is **logical (soft delete)**: the record leaves the grid and the KPIs but stays preserved in history

### Important:

- Changes apply to everyone who accesses the module
- Deleted rows are no longer included in KPI calculations
        `,
                category: 'indicadores-rs',
                keywords: ['edit', 'rows', 'grid', 'new row', 'delete', 'soft delete', 'search', 'sort']
            },
            {
                id: 'rs-kpis-avaliacao',
                title: 'How to read the KPIs and the assessment?',
                content: `
## Reading the KPIs and the Assessment

The indicators panel measures **service effectiveness**: the percentage of jobs sent to the client within the deadline.

### How to open it:

1. Open a dataset on the **R&S Indicators** page
2. Click the **"KPIs & Assessment"** button in the header

### What each indicator means:

- 🎯 **Effectiveness rate** - % of jobs sent to the client within the job deadline
- ⏱️ **Average sending time** - Average days between job opening and candidate submission
- 📅 **Sending target** - **7 days** to send candidates to the client
- ⏩ **Lead time buffer** - How far ahead of the deadline submissions happen, on average
- 🤝 **Retention per client** - % of employees who stayed (no replacement needed)

### Assessment levels:

- 🟢 **Excellent** - Effectiveness ≥ 90%
- 🔵 **Good** - Effectiveness ≥ 75%
- 🟡 **Attention** - Effectiveness ≥ 55%
- 🔴 **Critical** - Effectiveness < 55%

### Important:

KPIs are born from the **recognized columns** in the import: **job status**, **sending time** and **deadline**. Keep the spreadsheet standardized so the indicators are calculated correctly.
        `,
                category: 'indicadores-rs',
                keywords: ['kpi', 'kpis', 'assessment', 'effectiveness', 'target', 'deadline', 'retention', 'sending time', 'indicators']
            }
        ]
    },
    // ==========================================
    {
        id: 'dp-folha',
        name: 'Payroll Items & Payroll (DP)',
        description: 'Payroll items, WK Radar sync, payroll calculation and approval in the DP module',
        icon: 'FiFileText',
        articles: [
            {
                id: 'dp-folha-visao-geral',
                title: 'What is the Payroll Items & Payroll tab in the DP module?',
                content: `
## What is the Payroll Items & Payroll tab?

The **Payroll Items & Payroll** tab (menu **Department → HR Department**) closes the payroll cycle inside the DP: sync data from **WK Radar**, consolidate entries from portal modules (crew scale/boarding and vacations), **calculate** the payroll and submit it for **multi-signature approval**.

### Where to find it:

1. Open the **Department** menu
2. Click **"HR Department"**
3. Open the **"Payroll Items & Payroll"** tab

### Who can access:

Access is controlled by the **Payroll** module permissions:

- 👁️ **folha.view** - View payroll items, sheets and approvals
- ✏️ **folha.edit** - Entries, sync and payroll items
- ✅ **folha.approve** - Sign/approve or reject payroll sheets
- ⚙️ **folha.admin** - Configure approvers and full administration

### Where the data comes from:

- 🔗 **WK Radar** - Employees and payroll items (API sync or file import)
- 📋 **Scale/Boarding** - ON/DBA/FI/STB/TRE days from the portal closing
- 🌴 **Vacations** - Approved vacation leave from the vacations module
- ✍️ **Manual entries** - Always preserved across re-syncs

### Precedence:

If the same employee+item comes from WK and from portal modules, the **WK value wins** (it is the official calculation source) and the portal item is discarded with an audit record.
        `,
                category: 'dp-folha',
                keywords: ['payroll', 'hr', 'payroll items', 'wk', 'wkradar', 'sync', 'approval', 'module']
            },
            {
                id: 'dp-folha-fluxo',
                title: 'How to sync, calculate and approve the payroll?',
                content: `
## Full flow: sync → calculate → approve

Everything happens in the DP **Payroll Items & Payroll** tab, choosing the **competence** (month/year) and **company/department**.

### Step by step:

1. **Sync WK** - Pulls employees and payroll items from WK Radar (credentials required) or use **Import file** with the WK-exported spreadsheet

2. **Module consolidation** - The portal automatically adds scale/boarding and vacation entries for the month (items flagged as "portal" origin)

3. **Calculate payroll** - The engine computes INSS (2025 table, or from January 2026 the MPS/MF Ordinance 13/2026 table), IRRF (progressive table, simplified deduction and the 2026 reduction that zeroes tax up to R$ 5,000), FGTS and net pay per employee and per nature (monthly, 13th salary, vacation, termination)

4. **Submit for approval** - The modal lists the approvers; each one signs with their token until 100% is reached

5. **Result** - With all signatures, the sheet becomes **Approved** (with integrity hash); an approver can **Reject** with a reason — the sheet goes back for adjustment

### Unmapped codes:

If the WK spreadsheet brings a payroll code that does not exist in the portal, the sync is **aborted** with the code list. Map each one in the payroll items registry (**Payroll → Settings → Payroll Items**, "WK Code" field) and sync again. The portal **never creates** items automatically.

### Re-syncing loses nothing:

Re-running the sync replaces only WK and portal items. **Manual** entries stay intact.
        `,
                category: 'dp-folha',
                keywords: ['sync', 'calculate', 'approve', 'sign', 'reject', 'payroll', 'flow', 'code', 'mapping']
            },
            {
                id: 'dp-folha-rubricas',
                title: 'How to create and edit payroll items?',
                content: `
## Creating and editing payroll items

The payroll items registry lives in **Payroll → Settings → Payroll Items** and is the single source of codes used by the payroll and the WK mapping.

### Prerequisite:

- **folha.edit** permission

### Fields:

- **Code** and **Type** (earning/deduction/other) - Form the item identity; they become **locked** once the item has payroll entries
- **Name and description** - Shown on the payslip and screens
- **Calculation type**:
  - **Fixed** - Quantity × value
  - **Percentage** - % over the reference (e.g. night shift 20%)
  - **Formula** - Registered formula key (**dsr**, **reflexo**, **reflexo_he**)
  - **Legal** - Computed by the engine (INSS, IRRF, FGTS)
- **WK Code** - The equivalent code in WK Radar; it connects the WK spreadsheet to the portal item

### Deactivate vs delete:

- **Deactivate** (soft delete) - The item leaves the lists but entry history stays correct. It is the default delete behavior
- **System** items (INSS, IRRF, FGTS) must never be deactivated
        `,
                category: 'dp-folha',
                keywords: ['payroll item', 'create', 'edit', 'wk code', 'formula', 'dsr', 'reflexo', 'fixed', 'percentage', 'legal', 'deactivate']
            }
        ]
    }
];
