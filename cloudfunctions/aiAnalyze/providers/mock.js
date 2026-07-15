function cloneSuggestion(suggestion) {
  return {
    foodName: suggestion.foodName,
    estimatedGrams: suggestion.estimatedGrams,
    confidence: suggestion.confidence,
    per100gGuess: suggestion.per100gGuess ? { ...suggestion.per100gGuess } : undefined,
    matchedFoodId: suggestion.matchedFoodId,
  };
}

const MOCK_SUGGESTIONS = [
  {
    foodName: '白米饭',
    estimatedGrams: 150,
    confidence: 0.62,
    matchedFoodId: 'sys_white_rice_cooked',
    per100gGuess: { calories: 130, protein: 2.7, carb: 28, fat: 0.3 },
  },
  {
    foodName: '西兰花',
    estimatedGrams: 80,
    confidence: 0.55,
    matchedFoodId: 'sys_broccoli_cooked',
    per100gGuess: { calories: 34, protein: 2.8, carb: 7, fat: 0.4 },
  },
];

function createMockProvider() {
  return {
    name: 'mock',
    async analyze() {
      return {
        provider: 'mock',
        status: 'succeeded',
        suggestions: MOCK_SUGGESTIONS.map(cloneSuggestion),
      };
    },
  };
}

module.exports = { createMockProvider };
