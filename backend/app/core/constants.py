"""Fixed reference values shared with the frontend forms (login.html, poll.html)."""

STATES = [
    "ABA STATE", "ADOKA STATE", "AFEMI IGODOMIGODO STATE", "AHOADA STATE",
    "AKPAKIP ORO STATE", "ALANSO STATE", "ALAUDO STATE", "ANIOMA STATE",
    "BRANEM STATE", "CALABAR STATE", "EBONYI STATE", "EBUBE STATE",
    "EDDA STATE", "ENUGU STATE", "EPIE STATE", "ESAN IGODOMIGODO STATE",
    "EZEANI STATE", "IDEN IGODOMIGODO STATE", "IDUNG IBON STATE", "IGALA STATE",
    "IGBANI STATE", "IKA STATE", "IKEMBA STATE", "IKOM STATE",
    "IKWUMESIA STATE", "ITTAI STATE", "IWERE STATE", "IWHUNROHA STATE",
    "ODUMEGWU STATE", "OGBIA/IZON STATE", "OGOJA STATE", "OHABUEYI STATE",
    "OHAUKWU STATE", "OKIGWE STATE", "OMAMBALA STATE", "ORLU STATE",
    "OWERRI STATE", "QUA STATE", "SOUTH ATLANTIC STATE", "URHOBO/ISOKO STATE",
]

AGE_RANGES = ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"]

GENDERS = ["Male", "Female"]

# Poll categories — the filter buttons on polls.html use these exact keys
CATEGORIES = ["presidency", "governors", "economy", "security", "education", "healthcare", "governance"]

# Optional demographics asked on poll.html
EDUCATION_LEVELS = [
    "No formal education", "Primary school", "Secondary school",
    "Vocational / technical", "Bachelor's degree", "Postgraduate",
]

OCCUPATIONS = [
    "Agriculture / farming", "Trade / commerce", "Civil service",
    "Private sector employee", "Self-employed / entrepreneur", "Student",
    "Unemployed", "Retired", "Prefer not to say",
]

# Smallest group shown in public results; smaller groups, and polls with fewer
# responses than this, are withheld (docs/decisions/0001-minimum-public-group-size.md)
MIN_GROUP_SIZE = 10
