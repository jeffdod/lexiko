// Prepositions whose case the app cannot work out from the words around them, settled by hand.
// [book, chapter, verse, Strong's number of the preposition, which occurrence of it in that verse (1 = first), case].
// Case G / D / A is the case the preposition governs there; '-' means it is not acting as a preposition (an adverbial prefix),
// so it governs no case. Decided by the app's author; nothing here is Greek text.
export const PREP_CASES = [
  ['MAT', 1, 20, 2596, 1, 'A'],   // Matthew 1:20
  ['MAT', 2, 12, 2596, 1, 'A'],   // Matthew 2:12
  ['MAT', 2, 13, 2596, 1, 'A'],   // Matthew 2:13
  ['MAT', 2, 19, 2596, 1, 'A'],   // Matthew 2:19
  ['MAT', 2, 22, 2596, 1, 'A'],   // Matthew 2:22
  ['MAT', 8, 11, 3326, 1, 'G'],   // Matthew 8:11
  ['MAT', 27, 19, 2596, 1, 'A'],   // Matthew 27:19
  ['MRK', 6, 45, 4314, 1, 'A'],   // Mark 6:45
  ['MRK', 14, 19, 2596, 1, 'A'],   // Mark 14:19
  ['LUK', 15, 7, 1909, 2, 'D'],   // Luke 15:7
  ['JHN', 8, 9, 2596, 1, 'A'],   // John 8:9
  ['ACT', 3, 25, 4314, 2, 'A'],   // Acts 3:25
  ['ACT', 10, 16, 1909, 1, 'A'],   // Acts 10:16
  ['ACT', 11, 10, 1909, 1, 'A'],   // Acts 11:10
  ['ROM', 12, 5, 2596, 1, 'A'],   // Romans 12:5
  ['1CO', 14, 27, 2596, 1, 'A'],   // 1 Corinthians 14:27
  ['2CO', 6, 15, 4314, 1, 'A'],   // 2 Corinthians 6:15
  ['2CO', 11, 23, 5228, 1, 'A'],   // 2 Corinthians 11:23
  ['1TH', 3, 10, 5228, 1, '-'],   // 1 Thessalonians 3:10
  ['1TH', 5, 13, 5228, 1, '-'],   // 1 Thessalonians 5:13
  ['1TI', 5, 19, 1909, 1, 'G'],   // 1 Timothy 5:19
  ['HEB', 7, 9, 1223, 1, 'G'],   // Hebrews 7:9
  ['HEB', 11, 4, 3844, 1, 'A'],   // Hebrews 11:4
  ['HEB', 11, 9, 3326, 1, 'G'],   // Hebrews 11:9
  ['HEB', 11, 32, 4012, 1, 'G'],   // Hebrews 11:32
];
