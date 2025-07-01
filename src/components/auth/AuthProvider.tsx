/*
 * Copyright 2025 Greg Willis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use client";

import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "@/config/authConfig";

const msalInstance = new PublicClientApplication(msalConfig);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return (
        <MsalProvider instance={msalInstance}>
            {children}
        </MsalProvider>
    );
}
