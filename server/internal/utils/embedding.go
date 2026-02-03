package utils

import (
	"crypto/sha256"
	"fmt"
	"math"
	"strings"
	"unicode"
)

// GenerateEmbedding creates a 1536-dimensional vector from text using hash-based approach
func GenerateEmbedding(text string) []float32 {
	// Normalize text: lowercase and remove special characters
	normalized := strings.ToLower(text)
	normalized = strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || unicode.IsSpace(r) {
			return r
		}
		return ' '
	}, normalized)

	// Split into words
	words := strings.Fields(normalized)

	// Create word frequency map
	wordFreq := make(map[string]int)
	for _, word := range words {
		if len(word) > 2 { // Ignore very short words
			wordFreq[word]++
		}
	}

	// Generate 1536-dimensional vector
	dimension := 1536
	embedding := make([]float32, dimension)

	// Use hash-based approach to fill the vector
	hash := sha256.Sum256([]byte(text))

	// Fill vector using hash and word frequencies
	for i := 0; i < dimension; i++ {
		// Use different parts of the hash for different dimensions
		hashIndex := i % len(hash)
		hashValue := float32(hash[hashIndex]) / 255.0 // Normalize to 0-1

		// Add word frequency influence
		wordIndex := i % len(words)
		if wordIndex < len(words) && len(words[wordIndex]) > 2 {
			wordHash := sha256.Sum256([]byte(words[wordIndex]))
			wordValue := float32(wordHash[hashIndex]) / 255.0
			hashValue = (hashValue + wordValue) / 2.0
		}

		// Normalize to -1 to 1 range
		embedding[i] = (hashValue - 0.5) * 2.0
	}

	// L2 normalization
	var sum float64
	for _, val := range embedding {
		sum += float64(val * val)
	}
	norm := float32(math.Sqrt(sum))
	if norm > 0 {
		for i := range embedding {
			embedding[i] /= norm
		}
	}

	return embedding
}

// BuildEmbeddingText creates a text string from product information for embedding
func BuildEmbeddingText(name, category, description string, brand, color, material *string) string {
	parts := []string{name}
	parts = append(parts, category)
	if brand != nil {
		parts = append(parts, *brand)
	}
	if color != nil {
		parts = append(parts, *color)
	}
	if material != nil {
		parts = append(parts, *material)
	}
	parts = append(parts, description)
	return strings.Join(parts, " ")
}

// EmbeddingToString converts embedding vector to PostgreSQL vector format
func EmbeddingToString(embedding []float32) string {
	embeddingStr := "["
	for i, val := range embedding {
		if i > 0 {
			embeddingStr += ","
		}
		embeddingStr += fmt.Sprintf("%.6f", val)
	}
	embeddingStr += "]"
	return embeddingStr
}

