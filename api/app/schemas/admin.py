from typing import Literal

from pydantic import BaseModel


class UpdateWorkspaceServiceRequest(BaseModel):
    status: Literal["ACTIVE", "INACTIVE"]