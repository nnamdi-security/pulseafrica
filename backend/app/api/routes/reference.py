from fastapi import APIRouter, Response

from app.core.constants import (
    AGE_RANGES,
    CATEGORY_NAMES,
    EDUCATION_LEVELS,
    GENDERS,
    OCCUPATIONS,
    STATES,
)
from app.schemas.reference import Category, Reference

router = APIRouter(prefix="/reference", tags=["reference"])

# The lists only change with a release, so browsers may reuse them for an hour.
CACHE_CONTROL = "public, max-age=3600"


@router.get("", response_model=Reference)
def reference(response: Response) -> Reference:
    """States, age ranges, genders, education levels, occupations and poll categories,
    from the same constants the API validates against."""
    response.headers["Cache-Control"] = CACHE_CONTROL
    return Reference(
        states=STATES,
        age_ranges=AGE_RANGES,
        genders=GENDERS,
        education_levels=EDUCATION_LEVELS,
        occupations=OCCUPATIONS,
        categories=[Category(key=key, name=name) for key, name in CATEGORY_NAMES.items()],
    )
