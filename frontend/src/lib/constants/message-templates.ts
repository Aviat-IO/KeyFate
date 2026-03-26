export interface MessageTemplate {
  id: string
  title: string
  category: string
  description: string
  content: string
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "bitcoin-wallet",
    title: "Bitcoin Wallet Access",
    category: "Cryptocurrency",
    description:
      "Share access to a Bitcoin wallet with seed phrase and instructions",
    content: `BITCOIN WALLET ACCESS

Wallet Address: [Your wallet address]

12-Word Seed Phrase:
[word1] [word2] [word3] [word4]
[word5] [word6] [word7] [word8]
[word9] [word10] [word11] [word12]

Wallet Software: [e.g., Electrum, Bitcoin Core, hardware wallet name]

Additional Notes:
- Store this seed phrase securely
- Never share it with anyone else
- Access the wallet at: [website/software link]
- Current approximate balance: [amount] BTC

Important: Test the recovery process with a small amount first.`,
  },
  {
    id: "password-manager",
    title: "Password Manager Master Password",
    category: "Account Access",
    description: "Provide access to a password manager account",
    content: `PASSWORD MANAGER ACCESS

Service: [e.g., 1Password, LastPass, Bitwarden]
Email/Username: [your account email]
Master Password: [your master password]

Recovery Options:
- Recovery Key: [if applicable]
- Security Questions: [if applicable]

Access Instructions:
1. Go to [password manager website]
2. Log in with the credentials above
3. All my account passwords are stored there

Important Accounts:
- Email: [primary email provider]
- Bank: [bank name]
- Other: [list critical accounts]

Additional notes: [any special instructions]`,
  },
  {
    id: "estate-documents",
    title: "Estate Planning Document Location",
    category: "Legal",
    description: "Share location of important estate planning documents",
    content: `ESTATE PLANNING DOCUMENTS

Last Will and Testament:
- Physical Location: [address, safe deposit box, lawyer's office]
- Digital Copy: [cloud storage location or file path]
- Last Updated: [date]

Attorney Contact:
- Name: [attorney name]
- Firm: [law firm]
- Phone: [phone number]
- Email: [email address]

Additional Documents:
- Living Will: [location]
- Power of Attorney: [location]
- Trust Documents: [location]
- Property Deeds: [location]

Financial Advisors:
- [Name, company, contact info]

Important Notes:
[Any specific instructions or wishes]`,
  },
  {
    id: "safe-deposit-box",
    title: "Safe Deposit Box Instructions",
    category: "Physical Assets",
    description: "Provide access information for a safe deposit box",
    content: `SAFE DEPOSIT BOX ACCESS

Bank Name: [bank name]
Branch Location: [full address]
Branch Phone: [phone number]

Box Number: [box number]
Key Location: [where the key is stored]

Access Instructions:
1. Bring valid ID and the key
2. Ask for access to box #[number]
3. [Any additional authentication needed]

Contents Include:
- [List of valuable items]
- [Important documents]
- [Other assets]

Bank Representative:
- Name: [if you have a specific contact]
- Phone: [contact number]

Additional Notes:
[Special instructions or information]`,
  },
  {
    id: "cryptocurrency-exchange",
    title: "Cryptocurrency Exchange Account",
    category: "Cryptocurrency",
    description: "Share access to a cryptocurrency exchange account",
    content: `CRYPTOCURRENCY EXCHANGE ACCESS

Exchange: [e.g., Coinbase, Binance, Kraken]
Website: [exchange URL]

Login Credentials:
- Email: [account email]
- Password: [account password]
- 2FA Method: [Google Authenticator, SMS, email]
- 2FA Backup Codes: [if applicable]

Recovery Information:
- Recovery Email: [recovery email]
- Recovery Phone: [recovery phone]
- Security Questions: [answers if applicable]

Current Holdings (approximate):
- Bitcoin: [amount] BTC
- Ethereum: [amount] ETH
- Other: [list other holdings]

Important Notes:
- Enable 2FA if not already active
- Withdrawal addresses may require whitelist approval
- Consider transferring to personal wallet for long-term storage

Emergency Contact at Exchange:
- Support Email: [exchange support email]
- Account ID: [your account ID if applicable]`,
  },
  {
    id: "cloud-storage",
    title: "Cloud Storage Access",
    category: "Digital Assets",
    description: "Provide access to cloud storage accounts and important files",
    content: `CLOUD STORAGE ACCESS

Primary Storage:
- Service: [e.g., Google Drive, Dropbox, iCloud]
- Email: [account email]
- Password: [account password]
- 2FA: [2FA method and backup codes]

Important Folders:
- [Folder name]: [description of contents]
- [Folder name]: [description of contents]

Additional Cloud Accounts:
- [Service name]: [login details]

File Encryption:
[If files are encrypted, provide decryption instructions]

Access Instructions:
1. Log in to [service URL]
2. Navigate to [folder path]
3. [Any special instructions]

Total Storage Used: [approximate amount]

Notes:
[Any additional information about file organization or important files]`,
  },
  {
    id: "social-media-accounts",
    title: "Social Media Account Access",
    category: "Digital Legacy",
    description:
      "Share access to social media accounts for memorialization or closure",
    content: `SOCIAL MEDIA ACCOUNTS

Instructions: [Choose what you want done - memorialize, delete, transfer]

Facebook:
- Email: [account email]
- Password: [password]
- Profile URL: [your profile URL]

Instagram:
- Username: [username]
- Password: [password]

Twitter/X:
- Handle: [@yourhandle]
- Email: [account email]
- Password: [password]

LinkedIn:
- Email: [account email]
- Password: [password]

Other Accounts:
- [Platform]: [login details]

Memorialization Options:
- Facebook: [Set legacy contact or memorialize]
- Instagram: [Memorialize or remove]

My Wishes:
[Specific instructions about what you want done with each account]

Important Posts/Memories:
[If you want specific content saved or shared]`,
  },
]

export function getTemplateById(id: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find((template) => template.id === id)
}

export function getTemplatesByCategory(category: string): MessageTemplate[] {
  return MESSAGE_TEMPLATES.filter((template) => template.category === category)
}

export function getAllCategories(): string[] {
  const categories = new Set(MESSAGE_TEMPLATES.map((t) => t.category))
  return Array.from(categories).sort()
}
