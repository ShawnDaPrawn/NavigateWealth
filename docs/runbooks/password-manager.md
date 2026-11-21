# Super admin password manager

The database migration generates a 32-byte encryption key in Supabase Vault under `navigatewealth_password_manager_key`. Include that secret and the project’s Vault recovery material in your existing backup procedures. Restoring password records requires the matching key. Changing the key requires re-encrypting or re-importing those records.

In the admin sidebar, open the account settings dropdown and select **Password manager**. Add a single login or import a UTF-8 CSV with `url`, `username` and `password` headers. Optional columns are `name` and `notes` (or `note`). Each import creates new entries. A file accepts up to 100 entries and 1 MiB. After import, handle the plaintext export according to your organisation’s password handling procedures.

To connect a trusted service, select **MCP** beside its credential and create a token. In a client supporting Streamable HTTP and custom bearer authentication, enter the endpoint shown in the dialog and supply the token in the `Authorization: Bearer <token>` header. The client can call `get_credential` with an empty arguments object. The result contains the stored URL, username and plaintext password. Configure the receiving service to keep tool results out of logs and chat history.

Each credential supports one active token. Tokens expire after 90 days. Replacing the token, revoking access or deleting the entry stops subsequent reads. If a service already retrieved a password, rotate that password at the originating site to invalidate its copy. Password changes saved in the vault become available to the existing connection.

The vault encrypts records with AES-256-GCM before they enter the existing service-role KV store. The vault stores only token hashes and writes credential access events to the admin audit log using record IDs.
