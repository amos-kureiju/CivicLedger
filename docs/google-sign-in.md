# Google Sign-In for the web login

The Google-branded control is disabled. The current auth endpoint has no Google identity action.

- Create a Google OAuth web client and configure the consent screen. Register each authorized JavaScript origin, including `http://localhost:3000` for development. Register exact redirect URIs if using a redirect-based flow.
- Integrate Google Identity Services using that client ID. Use Google's rendered button when enabling sign-in. Keep any client secret on the server.
- Add a server endpoint that validates the Google credential with Google's supported library, including issuer, audience, expiry, and the flow's CSRF and nonce checks. For an authorization-code flow, validate state and exchange the code server-side.
- Map the verified Google subject to an eligible coordinator account through an explicit account-linking policy. Issue the existing server-side session and HTTP-only cookie only after that check.
- Enable the control once the server integration is available. Verify valid sign-in, denied accounts, invalid credentials, session persistence, and logout.
