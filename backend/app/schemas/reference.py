from app.schemas.base import CamelModel


class Category(CamelModel):
    key: str
    name: str


class Reference(CamelModel):
    """The fixed lists the forms and labels use, in display order (DB-03)."""

    states: list[str]
    age_ranges: list[str]
    genders: list[str]
    education_levels: list[str]
    occupations: list[str]
    categories: list[Category]
