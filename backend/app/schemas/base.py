from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Speaks camelCase JSON to the JavaScript frontend (fullName, ageRange, ...)
    while the Python code keeps snake_case attribute names."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
