# Shared renderer compatibility: Chrome 4.0.29

The Chrome-only web preview uses the existing workspace tool hook and does not replace the native Windows WebContentsView browser or its tool implementation. The retired connections popup is removed; existing provider connection controls and owner authentication are retained. Run the existing native Windows gates on this source commit before publishing the Chrome candidate. No standalone Windows release is requested.
