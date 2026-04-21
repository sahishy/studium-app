import { TextCensor, RegExpMatcher, englishDataset, englishRecommendedTransformers, DataSet, asteriskCensorStrategy } from 'obscenity'

const censor = new TextCensor().setStrategy(asteriskCensorStrategy());
const censorDataset = new DataSet()
    .addAll(englishDataset)
    .removePhrasesIf((phrase) => phrase.metadata.originalWord === 'god');
const matcher = new RegExpMatcher({
    ...censorDataset.build(),
    ...englishRecommendedTransformers,
});


const cleanText = ( text ) => {

    const input = text.trim();
    const matches = matcher.getAllMatches(input);
    const result = censor.applyTo(input, matches);

    return result;

}

const hasFlaggedWords = ( text ) => {

    const input = text.trim();
    const matches = matcher.getAllMatches(input);

    return matches.length > 0;

}

export {
    cleanText,
    hasFlaggedWords
}