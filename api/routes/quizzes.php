<?php
// ============================================================
//  Route: /api/quizzes[/:id]
//  Sprint 12 Phase 3 (2/2): Relational Quiz-Read
//
//  GET  /api/quizzes      → Liste (mit Fragen + Antworten)
//  GET  /api/quizzes/:id  → Einzelnes Quiz
// ============================================================

$auth = require_auth();
$uid  = (int)$auth['sub'];

function load_quiz_full(PDO $pdo, int $id): ?array {
    $s = $pdo->prepare("SELECT * FROM quizzes WHERE id = ? LIMIT 1");
    $s->execute([$id]);
    $quiz = $s->fetch();
    if (!$quiz) return null;

    $s = $pdo->prepare("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id");
    $s->execute([$id]);
    $questions = $s->fetchAll();

    foreach ($questions as &$q) {
        $s = $pdo->prepare("SELECT * FROM quiz_answers WHERE question_id = ? ORDER BY sort_order, id");
        $s->execute([(int)$q['id']]);
        $q['answers'] = $s->fetchAll();
    }
    unset($q);

    $quiz['questions'] = $questions;
    return $quiz;
}

// GET /api/quizzes/:id
if ($method === 'GET' && $id !== null) {
    $quiz = load_quiz_full(db(), $id);
    if (!$quiz) error('Quiz nicht gefunden', 404);
    respond($quiz);
}

// GET /api/quizzes — Liste
if ($method === 'GET' && $id === null) {
    $rows = db()->query("SELECT * FROM quizzes WHERE is_public = 1 ORDER BY created_at DESC")->fetchAll();
    foreach ($rows as &$quiz) {
        $qzId = (int)$quiz['id'];
        $s = db()->prepare("SELECT * FROM quiz_questions WHERE quiz_id = ? ORDER BY sort_order, id");
        $s->execute([$qzId]);
        $questions = $s->fetchAll();
        foreach ($questions as &$q) {
            $s2 = db()->prepare("SELECT * FROM quiz_answers WHERE question_id = ? ORDER BY sort_order, id");
            $s2->execute([(int)$q['id']]);
            $q['answers'] = $s2->fetchAll();
        }
        unset($q);
        $quiz['questions'] = $questions;
    }
    unset($quiz);
    respond($rows);
}

error('Methode nicht erlaubt', 405);
