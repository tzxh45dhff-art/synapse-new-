"""Model pricing table (USD per 1M tokens) + cost helpers.

Kept as plain data so cost tracking never guesses. Update as vendor prices
change. Unknown models cost 0 (logged, but not fabricated).
"""

from __future__ import annotations

# (input_per_1m, output_per_1m) in USD. Embeddings have no output component.
_PRICING: dict[str, tuple[float, float]] = {
    # OpenAI chat
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "gpt-4.1": (2.00, 8.00),
    # OpenAI embeddings
    "text-embedding-3-small": (0.02, 0.0),
    "text-embedding-3-large": (0.13, 0.0),
}


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int = 0) -> float:
    """Return estimated USD cost. Returns 0.0 for unknown models."""
    rates = _PRICING.get(model)
    if not rates:
        return 0.0
    input_rate, output_rate = rates
    cost = (prompt_tokens / 1_000_000) * input_rate + (completion_tokens / 1_000_000) * output_rate
    return round(cost, 6)
