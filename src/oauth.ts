import { FhirClient as NS, FhirClient, fhir }  from "..";
import { btoa }                                from "Base64";
import Adapter                                 from "./adapter";
import Client                                  from "./Client";
import {
    urlParam,
    getPath,
    urlToAbsolute,
    randomString
} from "./lib";


// $lab:coverage:off$
function debug(...args) {
    if (sessionStorage.debug) {
        console.log(...args);
    }
}
// $lab:coverage:on$

export function fetchConformanceStatement(baseUrl?: string): Promise<fhir.CapabilityStatement> {
    if (!baseUrl) {
        baseUrl = location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "");
    }
    const url = String(baseUrl).replace(/\/*$/, "/") + "metadata";
    return Adapter.get().http({ method: "GET", url }).then(
        ({ data }) => data,
        ex => {
            debug(ex);
            throw new Error(`Failed to fetch the conformance statement from "${url}"`);
        }
    );
}

/**
 * Given a fhir server returns an object with it's Oauth security endpoints
 * @param baseUrl Fhir server base URL
 */
export function getSecurityExtensions(metadata?: fhir.CapabilityStatement): NS.OAuthSecurityExtensions {
    const nsUri = "http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris";
    const extensions = (getPath(metadata || {}, "rest.0.security.extension") || [])
        .filter(e => e.url === nsUri)
        .map(o => o.extension)[0];

    const out: NS.OAuthSecurityExtensions = {
        registrationUri : "",
        authorizeUri    : "",
        tokenUri        : ""
    };

    if (extensions) {
        extensions.forEach(ext => {
            if (ext.url === "register") {
                out.registrationUri = ext.valueUri;
            }
            if (ext.url === "authorize") {
                out.authorizeUri = ext.valueUri;
            }
            if (ext.url === "token") {
                out.tokenUri = ext.valueUri;
            }
        });
    }
    return out;
}

/**
 * Calls the buildAuthorizeUrl function to construct the redirect URL and then
 * just redirects to it.
 */
export function authorize(options: NS.ClientOptions, loc: Location = location): Promise<any> {
    debug(`Authorizing...`);
    return buildAuthorizeUrl(options, loc)
    .then(redirect => {
        debug(`Making authorize redirect to ${redirect}`);
        try {
            loc.href = redirect;
        } catch (ex) {
            throw new Error(`Unable to redirect to ${redirect}. ${ex}`);
        }
        return redirect;
    });
}

/**
 * First discovers the fhir server base URL from query.iis or query.fhirServiceUrl
 * or options.serverUrl. Then compiles the proper authorization URL for that server.
 * For open servers that URL is the options.redirectUri so that we can skip the
 * authorization part.
 */
export function buildAuthorizeUrl(options: NS.ClientOptions, loc: Location = location): Promise<string> {
    const launch         = urlParam("launch"        , { location: loc });
    const iss            = urlParam("iss"           , { location: loc });
    const fhirServiceUrl = urlParam("fhirServiceUrl", { location: loc });

    const serverUrl = String(iss || fhirServiceUrl || options.serverUrl || "");

    if (iss && !launch) {
        return Promise.reject(new Error(`Missing url parameter "launch"`));
    }

    if (!serverUrl) {
        return Promise.reject(new Error(
            "No server url found. It must be specified as query.iss or " +
            "query.fhirServiceUrl or options.serverUrl (in that order)"
        ));
    }

    debug(`Looking up the authorization endpoint for "${serverUrl}"`);
    return fetchConformanceStatement(serverUrl).then(metadata => {
        const extensions = getSecurityExtensions(metadata);
        debug(`Found security extensions: `, extensions);

        // Prepare the object that will be stored in the session
        const state: NS.ClientState = {
            serverUrl,
            clientId   : options.clientId,
            redirectUri: urlToAbsolute(options.redirectUri || "."),
            scope      : options.scope || "",
            ...extensions
        };

        if (options.clientSecret) {
            debug(`Adding clientSecret to the state`);
            state.clientSecret = options.clientSecret;
        }

        const id = randomString(32);
        sessionStorage.setItem(id, JSON.stringify(state));
        // sessionStorage.setItem(tokenResponse, JSON.stringify(state));

        let redirectUrl = state.redirectUri;
        // debug(state);
        if (state.authorizeUri) {
            debug(`authorizeUri: ${state.authorizeUri}`);
            const params = [
                "response_type=code",
                "client_id="    + encodeURIComponent(state.clientId),
                "scope="        + encodeURIComponent(state.scope),
                "redirect_uri=" + encodeURIComponent(state.redirectUri),
                "aud="          + encodeURIComponent(state.serverUrl),
                "state="        + id
            ];

            // also pass this in case of EHR launch
            if (launch) {
                params.push("launch=" + encodeURIComponent(launch as string));
            }

            redirectUrl = state.authorizeUri + "?" + params.join("&");
        }

        return redirectUrl;
    });
}

export function getState(id: string): FhirClient.ClientState {
    if (!id) {
        throw new Error(`Cannot look up state by the given id (${id})`);
    }
    const cached = sessionStorage.getItem(id as string);
    if (!cached) {
        throw new Error(`No state found by the given id (${id})`);
    }
    try {
        const json = JSON.parse(cached);
        return json;
    } catch (_) {
        throw new Error(`Corrupt state: sessionStorage['${id}'] cannot be parsed as JSON.`);
    }
}

export function setState(key: string, value: FhirClient.ClientState) {
    sessionStorage.setItem(key, JSON.stringify(value));
}

/**
 * Builds the token request options for axios. Does not make the request, just
 * creates it's configuration and returns it in a Promise.
 * NOTE that this function has side effects because it modifies the storage
 * contents.
 * @param req
 * @param storage
 */
export function buildTokenRequest(code: string, state: FhirClient.ClientState): any {

    if (!state.redirectUri) {
        throw new Error(`Missing state.redirectUri`);
    }

    if (!state.tokenUri) {
        throw new Error(`Missing state.tokenUri`);
    }

    if (!state.clientId) {
        throw new Error(`Missing state.clientId`);
    }

    const requestOptions: any = {
        method: "POST",
        url   : state.tokenUri,
        headers: {
            "content-type": "application/x-www-form-urlencoded"
        },
        data: {
            code,
            grant_type  : "authorization_code",
            redirect_uri: state.redirectUri
        }
    };

    // For public apps, authentication is not possible (and thus not
    // required), since the app cannot be trusted to protect a secret.
    // For confidential apps, an Authorization header using HTTP Basic
    // authentication is required, where the username is the app’s client_id
    // and the password is the app’s client_secret
    if (state.clientSecret) {
        requestOptions.headers.Authorization = "Basic " + btoa(
            state.clientId + ":" + state.clientSecret
        );
        debug(
            `Using state.clientSecret to construct the authorization header: "${
            requestOptions.headers.Authorization}"`
        );
    } else {
        debug(`No clientSecret found in state. Adding client_id to the POST body`);
        requestOptions.data.client_id = state.clientId;
    }

    return requestOptions;
}

/**
 * After successful authorization we have received a code and state parameters.
 * Use this function to exchange that code for an access token and complete the
 * authorization flow.
 */
export function completeAuth(): Promise<Client> {
    debug("Completing the code flow");
    const state          = urlParam("state");
    const code           = urlParam("code");
    const cached         = getState(state as string);
    const requestOptions = buildTokenRequest(code as string, cached);

    // The EHR authorization server SHALL return a JSON structure that
    // includes an access token or a message indicating that the
    // authorization request has been denied.
    return Adapter.get().http(requestOptions)
        .then(
            ({ data }) => {
                debug(`Received tokenResponse. Saving it to the state...`);
                cached.tokenResponse = data;
                setState(state as string, cached);
                return new Client(cached);
            }
            , error => {
                // TODO: handle (humanize) token error
                // console.log(error.message);
                throw error;
            }
        );
}
