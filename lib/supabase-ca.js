/* B&S: Das Wurzelzertifikat von Supabase — öffentlich, kein Geheimnis.
 *
 * Supabase stellt die Zertifikate seiner Datenbank-Server selbst aus. Der Standard-Vorrat an
 * Zertifizierungsstellen, den Node mitbringt, kennt diese Wurzel nicht — eine Verbindung mit
 * echter Prüfung scheitert deshalb mit SELF_SIGNED_CERT_IN_CHAIN. Genau daran ist die
 * Trainings-App vom 30.09. bis 03.10.2026 gescheitert, sichtbar erst durch /api/diagnose.
 *
 * Die beiden falschen Auswege wären gewesen: die Prüfung abschalten (dann kann sich zwischen
 * Function und Datenbank jeder dazwischensetzen und Gesundheitsdaten samt DB-Passwort mitlesen)
 * oder das Zertifikat in eine Umgebungsvariable zu legen (dann steht ein 1,4-KB-Text in zwei
 * Projekten und niemand weiß beim nächsten Mal, woher er kam). Richtig ist: die Wurzel
 * mitliefern und gegen sie prüfen.
 *
 * Herkunft: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
 * Inhaber und Aussteller: Supabase Inc, "Supabase Root 2021 CA"
 * Gültig bis: 26.04.2031 — danach muss hier ein neues stehen.
 *
 * Ein CA-Zertifikat ist ein öffentlicher Schlüssel. Dass es in einem öffentlichen Repository
 * liegt, ist unbedenklich; es dient dem Prüfen, nicht dem Zugang.
 */
export const SUPABASE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----`;

/** Hosts, für die diese Wurzel gilt. */
export const istSupabase = host =>
  typeof host === 'string' && (host.endsWith('.supabase.co') || host.endsWith('.supabase.com'));
