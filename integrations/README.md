# AgentGuard Integrations

AgentGuard is designed to be framework-agnostic. While the core SDK is pure Python, it easily integrates with popular agent frameworks.

## 🦜🔗 LangChain Integration

You can wrap any LangChain tool or chain with the `@haas.governed` decorator.

```python
from langchain.tools import tool
from agentguard import haas

@tool
@haas.governed(tier="high", pool="security")
def delete_user_data(user_id: str):
    """Deletes a user's data from the database."""
    # This logic only executes after human approval
    return db.delete(user_id)

# The tool acts normally, but will raise an exception/pause
# if the governance check is triggered
```

## 🛶 CrewAI Integration

For CrewAI, you can govern the tools that your agents use.

```python
from crewai import Agent, Task, Crew, Process
from agentguard import haas

class BankTools:
    @annotated_tool
    @haas.governed(tier="critical", pool="finance")
    def wire_transfer(amount: float, recipient: str):
        """Transfers money to a recipient."""
        return bank.transfer(amount, recipient)

# Assign the governed tool to an agent
finance_agent = Agent(
    role='Finance Manager',
    goal='Manage payments',
    backstory='Responsible for approving large transactions',
    tools=[BankTools.wire_transfer],
    verbose=True
)
```

## 🤖 OpenClaw / Custom Agents

For custom agents using MCP, simply ensure your tool execution layer calls the governed function. AgentGuard handles the interception and P2P broadcasting automatically.
