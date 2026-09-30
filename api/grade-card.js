<style>
  /* ==========================================================
     ON THE PULL TCG
     PURPLE + GOLD AI CARD GRADER
  ========================================================== */

  .otp-grader {
    --otp-bg: #080512;
    --otp-bg-2: #0f091c;
    --otp-card: rgba(24, 13, 42, 0.92);
    --otp-card-light: #1a0f2e;

    --otp-purple: #7c3aed;
    --otp-purple-light: #a855f7;
    --otp-purple-dark: #4c1d95;

    --otp-gold: #f5c542;
    --otp-gold-light: #ffe08a;
    --otp-gold-dark: #b8860b;

    --otp-text: #faf7ff;
    --otp-muted: #b9aecb;
    --otp-border: rgba(245, 197, 66, 0.22);

    color: var(--otp-text);

    min-height: 100vh;

    padding: 55px 16px;

    background:
      radial-gradient(
        circle at 50% -10%,
        rgba(124, 58, 237, 0.28),
        transparent 40%
      ),
      radial-gradient(
        circle at 10% 50%,
        rgba(245, 197, 66, 0.06),
        transparent 30%
      ),
      linear-gradient(
        180deg,
        #080512 0%,
        #0c0617 50%,
        #080512 100%
      );

    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Roboto,
      Helvetica,
      Arial,
      sans-serif;

    box-sizing: border-box;
  }


  .otp-grader *,
  .otp-grader *::before,
  .otp-grader *::after {
    box-sizing: border-box;
  }


  .otp-container {
    width: 100%;
    max-width: 1050px;
    margin: 0 auto;
  }


  /* ==========================================================
     MAIN CARD
  ========================================================== */

  .otp-main-card {

    position: relative;

    overflow: hidden;

    background:
      linear-gradient(
        145deg,
        rgba(31, 17, 53, 0.96),
        rgba(12, 6, 23, 0.96)
      );

    border: 1px solid var(--otp-border);

    border-radius: 24px;

    padding: 32px;

    box-shadow:
      0 30px 80px rgba(0, 0, 0, 0.55),
      0 0 60px rgba(124, 58, 237, 0.08);
  }


  .otp-main-card::before {

    content: "";

    position: absolute;

    top: 0;
    left: 10%;
    right: 10%;

    height: 2px;

    background:
      linear-gradient(
        90deg,
        transparent,
        var(--otp-gold),
        var(--otp-purple-light),
        var(--otp-gold),
        transparent
      );

    opacity: 0.8;
  }


  /* ==========================================================
     HEADER
  ========================================================== */

  .otp-header {

    text-align: center;

    margin-bottom: 36px;
  }


  .otp-brand {

    display: inline-block;

    margin-bottom: 10px;

    color: var(--otp-gold);

    font-size: 11px;

    font-weight: 900;

    letter-spacing: 0.22em;

    text-transform: uppercase;
  }


  .otp-title {

    margin: 0;

    background:
      linear-gradient(
        135deg,
        #fff4bd 0%,
        var(--otp-gold) 45%,
        #dcae27 100%
      );

    -webkit-background-clip: text;
    background-clip: text;

    color: transparent;

    font-size: clamp(
      30px,
      5vw,
      46px
    );

    line-height: 1.08;

    font-weight: 900;

    letter-spacing: -0.03em;
  }


  .otp-subtitle {

    max-width: 700px;

    margin: 14px auto 0;

    color: var(--otp-muted);

    font-size: 14px;

    line-height: 1.7;
  }


  /* ==========================================================
     UPLOAD GRID
  ========================================================== */

  .otp-upload-grid {

    display: grid;

    grid-template-columns:
      repeat(
        2,
        minmax(0, 1fr)
      );

    gap: 20px;
  }


  .otp-upload {

    position: relative;

    padding: 24px;

    text-align: center;

    background:
      linear-gradient(
        145deg,
        rgba(40, 21, 65, 0.9),
        rgba(18, 9, 31, 0.9)
      );

    border:
      1px dashed
      rgba(245, 197, 66, 0.28);

    border-radius: 17px;

    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;
  }


  .otp-upload:hover {

    border-color:
      rgba(245, 197, 66, 0.65);

    box-shadow:
      0 0 30px
      rgba(124, 58, 237, 0.12);

    transform: translateY(-1px);
  }


  .otp-upload-title {

    margin-bottom: 13px;

    color: #eee7fa;

    font-size: 15px;

    font-weight: 800;
  }


  .otp-upload-subtitle {

    margin-bottom: 15px;

    color: #817590;

    font-size: 11px;
  }


  .otp-file {

    width: 100%;

    color: #a99bbd;

    font-size: 12px;
  }


  .otp-file::file-selector-button {

    margin-right: 10px;

    padding:
      9px
      15px;

    border: 0;

    border-radius: 9px;

    background:
      linear-gradient(
        135deg,
        var(--otp-gold),
        #d9a91e
      );

    color: #241600;

    font-weight: 900;

    cursor: pointer;

    transition:
      transform 0.15s ease,
      filter 0.15s ease;
  }


  .otp-file::file-selector-button:hover {

    filter: brightness(1.1);

    transform: translateY(-1px);
  }


  /* ==========================================================
     IMAGE PREVIEW
  ========================================================== */

  .otp-preview {

    display: none;

    margin-top: 18px;
  }


  .otp-preview.visible {

    display: block;
  }


  .otp-preview img {

    display: block;

    max-width: 100%;

    max-height: 270px;

    margin: 0 auto;

    border-radius: 11px;

    border:
      1px solid
      rgba(245, 197, 66, 0.3);

    box-shadow:
      0 12px 35px
      rgba(0, 0, 0, 0.4);
  }


  /* ==========================================================
     ACTION BUTTON
  ========================================================== */

  .otp-submit {

    width: 100%;

    margin-top: 24px;

    padding: 17px 20px;

    border: 1px solid
      rgba(255, 224, 138, 0.45);

    border-radius: 13px;

    background:
      linear-gradient(
        135deg,
        #f8d35b,
        #d9a91e
      );

    color: #211500;

    font-size: 16px;

    font-weight: 900;

    cursor: pointer;

    box-shadow:
      0 10px 30px
      rgba(245, 197, 66, 0.15);

    transition:
      transform 0.18s ease,
      box-shadow 0.18s ease,
      filter 0.18s ease;
  }


  .otp-submit:hover:not(:disabled) {

    transform: translateY(-2px);

    filter: brightness(1.06);

    box-shadow:
      0 14px 38px
      rgba(245, 197, 66, 0.24);
  }


  .otp-submit:disabled {

    opacity: 0.65;

    cursor: not-allowed;
  }


  /* ==========================================================
     LOADING
  ========================================================== */

  .otp-loading {

    display: none;

    align-items: center;

    justify-content: center;

    gap: 10px;
  }


  .otp-loading.visible {

    display: flex;
  }


  .otp-spinner {

    width: 20px;

    height: 20px;

    border:
      3px solid
      rgba(33, 21, 0, 0.2);

    border-top-color:
      #211500;

    border-radius: 50%;

    animation:
      otp-spin 0.8s linear infinite;
  }


  @keyframes otp-spin {

    to {
      transform: rotate(360deg);
    }
  }


  /* ==========================================================
     ERROR
  ========================================================== */

  .otp-error {

    display: none;

    margin-top: 18px;

    padding: 14px 16px;

    background:
      rgba(239, 68, 68, 0.1);

    border:
      1px solid
      rgba(239, 68, 68, 0.3);

    border-radius: 11px;

    color: #fca5a5;

    font-size: 13px;

    line-height: 1.5;
  }


  .otp-error.visible {

    display: block;
  }


  /* ==========================================================
     RESULTS
  ========================================================== */

  .otp-results {

    display: none;

    margin-top: 45px;

    padding-top: 34px;

    border-top:
      1px solid
      rgba(245, 197, 66, 0.14);
  }


  .otp-results.visible {

    display: block;
  }


  .otp-section-title {

    margin:
      0 0 18px;

    color: #f7f1ff;

    font-size: 22px;

    font-weight: 900;

    letter-spacing: -0.01em;
  }


  /* ==========================================================
     IDENTIFICATION
  ========================================================== */

  .otp-identification {

    display: grid;

    grid-template-columns:
      repeat(
        4,
        minmax(0, 1fr)
      );

    gap: 10px;

    margin-bottom: 30px;
  }


  .otp-info {

    padding: 15px;

    background:
      rgba(21, 11, 36, 0.85);

    border:
      1px solid
      rgba(245, 197, 66, 0.12);

    border-radius: 12px;
  }


  .otp-info-label {

    margin-bottom: 6px;

    color: #7d718c;

    font-size: 9px;

    font-weight: 900;

    letter-spacing: 0.1em;

    text-transform: uppercase;
  }


  .otp-info-value {

    color: #faf7ff;

    font-size: 14px;

    font-weight: 800;

    word-break: break-word;
  }


  /* ==========================================================
     GRADE CARDS
  ========================================================== */

  .otp-grade-grid {

    display: grid;

    grid-template-columns:
      repeat(
        3,
        minmax(0, 1fr)
      );

    gap: 15px;
  }


  .otp-grade-card {

    position: relative;

    overflow: hidden;

    padding: 22px;

    text-align: center;

    background:
      linear-gradient(
        150deg,
        rgba(36, 19, 61, 0.95),
        rgba(16, 8, 28, 0.95)
      );

    border:
      1px solid
      rgba(245, 197, 66, 0.16);

    border-radius: 17px;
  }


  .otp-grade-card::before {

    content: "";

    position: absolute;

    top: 0;
    left: 20%;
    right: 20%;

    height: 1px;

    background:
      linear-gradient(
        90deg,
        transparent,
        var(--otp-gold),
        transparent
      );
  }


  .otp-company {

    color: #a89bb8;

    font-size: 10px;

    font-weight: 900;

    letter-spacing: 0.14em;

    text-transform: uppercase;
  }


  .otp-grade {

    margin:
      12px 0;

    background:
      linear-gradient(
        135deg,
        #fff0a6,
        var(--otp-gold),
        #d49d16
      );

    -webkit-background-clip: text;
    background-clip: text;

    color: transparent;

    font-size: 38px;

    line-height: 1;

    font-weight: 950;
  }


  .otp-confidence {

    display: inline-block;

    padding:
      5px
      9px;

    border-radius: 999px;

    background:
      rgba(124, 58, 237, 0.18);

    border:
      1px solid
      rgba(168, 85, 247, 0.18);

    color: #cdbcf0;

    font-size: 9px;

    font-weight: 800;

    text-transform: uppercase;
  }


  .otp-reason {

    margin:
      17px 0 0;

    padding-top: 14px;

    border-top:
      1px solid
      rgba(255,255,255,0.06);

    color: #c6bbd1;

    font-size: 12px;

    line-height: 1.65;

    text-align: left;
  }


  .otp-subgrades {

    margin-top: 13px;

    padding: 11px;

    background:
      rgba(5, 2, 11, 0.65);

    border-radius: 9px;

    color: #a99bbd;

    font-family: monospace;

    font-size: 10px;

    line-height: 1.7;
  }


  /* ==========================================================
     RECOMMENDATION
  ========================================================== */

  .otp-recommendation {

    position: relative;

    overflow: hidden;

    margin-top: 25px;

    padding: 27px 22px;

    text-align: center;

    background:
      linear-gradient(
        135deg,
        rgba(82, 42, 130, 0.3),
        rgba(20, 9, 35, 0.95)
      );

    border:
      1px solid
      rgba(245, 197, 66, 0.3);

    border-radius: 17px;

    box-shadow:
      0 0 45px
      rgba(124, 58, 237, 0.08);
  }


  .otp-recommendation::before {

    content: "";

    position: absolute;

    top: 0;
    left: 0;
    right: 0;

    height: 2px;

    background:
      linear-gradient(
        90deg,
        transparent,
        var(--otp-gold),
        var(--otp-purple-light),
        var(--otp-gold),
        transparent
      );
  }


  .otp-rec-label {

    color: var(--otp-gold);

    font-size: 10px;

    font-weight: 900;

    letter-spacing: 0.15em;

    text-transform: uppercase;
  }


  .otp-rec-service {

    margin:
      8px 0;

    color: #fff;

    font-size: 32px;

    font-weight: 950;
  }


  .otp-rec-grade {

    color:
      var(--otp-gold);

    font-size: 17px;

    font-weight: 900;
  }


  .otp-rec-verdict {

    display: inline-block;

    margin-top: 12px;

    padding:
      7px
      13px;

    background:
      rgba(245, 197, 66, 0.1);

    border:
      1px solid
      rgba(245, 197, 66, 0.2);

    border-radius: 999px;

    color:
      var(--otp-gold-light);

    font-size: 10px;

    font-weight: 900;

    text-transform: uppercase;
  }


  .otp-rec-reason {

    max-width: 720px;

    margin:
      15px auto 0;

    color: #c7bdd1;

    font-size: 13px;

    line-height: 1.7;
  }


  /* ==========================================================
     SUMMARY
  ========================================================== */

  .otp-summary {

    margin-top: 25px;

    padding: 21px;

    background:
      rgba(20, 10, 34, 0.9);

    border:
      1px solid
      rgba(245, 197, 66, 0.12);

    border-radius: 15px;
  }


  .otp-summary-title {

    margin:
      0 0 10px;

    color: #f7f0ff;

    font-size: 15px;

    font-weight: 900;
  }


  .otp-summary-text {

    margin: 0;

    color: #c5b9d0;

    font-size: 13px;

    line-height: 1.75;
  }


  /* ==========================================================
     DIAGNOSTICS
  ========================================================== */

  .otp-diagnostics {

    margin-top: 25px;

    padding: 21px;

    background:
      rgba(20, 10, 34, 0.9);

    border:
      1px solid
      rgba(245, 197, 66, 0.12);

    border-radius: 15px;
  }


  .otp-diagnostic-row {

    display: flex;

    justify-content: space-between;

    gap: 20px;

    padding:
      12px 0;

    border-bottom:
      1px solid
      rgba(255,255,255,0.05);

    font-size: 12px;
  }


  .otp-diagnostic-row:last-child {

    border-bottom: 0;
  }


  .otp-diagnostic-label {

    color: #8e829b;
  }


  .otp-diagnostic-value {

    max-width: 65%;

    color: #e9e1f0;

    text-align: right;
  }


  /* ==========================================================
     DISCLAIMER
  ========================================================== */

  .otp-disclaimer {

    margin-top: 22px;

    color: #675d70;

    font-size: 10px;

    line-height: 1.65;

    text-align: center;
  }


  /* ==========================================================
     MOBILE
  ========================================================== */

  @media (max-width: 750px) {

    .otp-main-card {
      padding: 20px;
      border-radius: 18px;
    }

    .otp-upload-grid {
      grid-template-columns: 1fr;
    }

    .otp-identification {
      grid-template-columns:
        repeat(
          2,
          minmax(0, 1fr)
        );
    }

    .otp-grade-grid {
      grid-template-columns: 1fr;
    }

    .otp-diagnostic-row {
      flex-direction: column;
      gap: 5px;
    }

    .otp-diagnostic-value {
      max-width: 100%;
      text-align: left;
    }
  }


  @media (max-width: 450px) {

    .otp-grader {
      padding:
        30px 9px;
    }

    .otp-identification {
      grid-template-columns: 1fr;
    }

    .otp-title {
      font-size: 30px;
    }
  }
</style>


<div class="otp-grader">

  <div class="otp-container">

    <div class="otp-main-card">

      <!-- ====================================================
           HEADER
      ==================================================== -->

      <div class="otp-header">

        <div class="otp-brand">
          ON THE PULL TCG
        </div>

        <h1 class="otp-title">
          AI Card Grade Pre-Screener
        </h1>

        <p class="otp-subtitle">
          Upload clear photos of the front and back of your
          trading card. Our AI will identify the card and
          estimate PSA, BGS and ACE grades before you submit.
        </p>

      </div>


      <!-- ====================================================
           FORM
      ==================================================== -->

      <form id="card-grader-form">

        <div class="otp-upload-grid">

          <!-- FRONT -->

          <div class="otp-upload">

            <div class="otp-upload-title">
              Card Front
            </div>

            <div class="otp-upload-subtitle">
              Use a clear, straight-on photograph
            </div>

            <input
              type="file"
              id="front-file"
              class="otp-file"
              accept="image/*"
              required
            >

            <div
              id="front-preview-container"
              class="otp-preview"
            >

              <img
                id="front-preview"
                alt="Card front preview"
              >

            </div>

          </div>


          <!-- BACK -->

          <div class="otp-upload">

            <div class="otp-upload-title">
              Card Back
            </div>

            <div class="otp-upload-subtitle">
              Use a clear, straight-on photograph
            </div>

            <input
              type="file"
              id="back-file"
              class="otp-file"
              accept="image/*"
              required
            >

            <div
              id="back-preview-container"
              class="otp-preview"
            >

              <img
                id="back-preview"
                alt="Card back preview"
              >

            </div>

          </div>

        </div>


        <!-- ==================================================
             SUBMIT
        ================================================== -->

        <button
          type="submit"
          id="grader-submit-btn"
          class="otp-submit"
        >

          <span id="grader-button-text">
            Analyze My Card
          </span>

          <span
            id="grader-loading"
            class="otp-loading"
          >

            <span class="otp-spinner"></span>

            <span id="grader-loading-text">
              Analyzing card...
            </span>

          </span>

        </button>

      </form>


      <!-- ====================================================
           ERROR
      ==================================================== -->

      <div
        id="grader-error"
        class="otp-error"
      ></div>


      <!-- ====================================================
           RESULTS
      ==================================================== -->

      <div
        id="grader-results"
        class="otp-results"
      >

        <!-- CARD IDENTIFICATION -->

        <h2 class="otp-section-title">
          Card Identification
        </h2>


        <div class="otp-identification">

          <div class="otp-info">

            <div class="otp-info-label">
              Card Name
            </div>

            <div
              id="result-card-name"
              class="otp-info-value"
            >
              —
            </div>

          </div>


          <div class="otp-info">

            <div class="otp-info-label">
              Set
            </div>

            <div
              id="result-set-name"
              class="otp-info-value"
            >
              —
            </div>

          </div>


          <div class="otp-info">

            <div class="otp-info-label">
              Card Number
            </div>

            <div
              id="result-card-number"
              class="otp-info-value"
            >
              —
            </div>

          </div>


          <div class="otp-info">

            <div class="otp-info-label">
              Rarity
            </div>

            <div
              id="result-rarity"
              class="otp-info-value"
            >
              —
            </div>

          </div>


          <div class="otp-info">

            <div class="otp-info-label">
              Language
            </div>

            <div
              id="result-language"
              class="otp-info-value"
            >
              —
            </div>

          </div>


          <div class="otp-info">

            <div class="otp-info-label">
              Variant
            </div>

            <div
              id="result-variant"
              class="otp-info-value"
            >
              —
            </div>

          </div>


          <div class="otp-info">

            <div class="otp-info-label">
              Identification Confidence
            </div>

            <div
              id="result-id-confidence"
              class="otp-info-value"
            >
              —
            </div>

          </div>

        </div>


        <!-- ==================================================
             GRADES
        ================================================== -->

        <h2 class="otp-section-title">
          Estimated Grades
        </h2>


        <div class="otp-grade-grid">

          <!-- PSA -->

          <div class="otp-grade-card">

            <div class="otp-company">
              PSA
            </div>

            <div
              id="res-psa-grade"
              class="otp-grade"
            >
              —
            </div>

            <div
              id="res-psa-confidence"
              class="otp-confidence"
            >
              —
            </div>

            <p
              id="res-psa-reason"
              class="otp-reason"
            ></p>

          </div>


          <!-- BGS -->

          <div class="otp-grade-card">

            <div class="otp-company">
              Beckett / BGS
            </div>

            <div
              id="res-bgs-grade"
              class="otp-grade"
            >
              —
            </div>

            <div
              id="res-bgs-confidence"
              class="otp-confidence"
            >
              —
            </div>

            <div
              id="res-bgs-subs"
              class="otp-subgrades"
            ></div>

            <p
              id="res-bgs-reason"
              class="otp-reason"
            ></p>

          </div>


          <!-- ACE -->

          <div class="otp-grade-card">

            <div class="otp-company">
              ACE Grading
            </div>

            <div
              id="res-ace-grade"
              class="otp-grade"
            >
              —
            </div>

            <div
              id="res-ace-confidence"
              class="otp-confidence"
            >
              —
            </div>

            <p
              id="res-ace-reason"
              class="otp-reason"
            ></p>

          </div>

        </div>


        <!-- ==================================================
             RECOMMENDATION
        ================================================== -->

        <div class="otp-recommendation">

          <div class="otp-rec-label">
            Recommended Grading Service
          </div>

          <div
            id="recommended-service"
            class="otp-rec-service"
          >
            —
          </div>

          <div
            id="recommendation-grade"
            class="otp-rec-grade"
          ></div>

          <div
            id="recommendation-verdict"
            class="otp-rec-verdict"
          >
            —
          </div>

          <p
            id="recommendation-reason"
            class="otp-rec-reason"
          ></p>

        </div>


        <!-- ==================================================
             SUMMARY
        ================================================== -->

        <div class="otp-summary">

          <h3 class="otp-summary-title">
            Condition Summary
          </h3>

          <p
            id="res-grade-summary"
            class="otp-summary-text"
          ></p>

        </div>


        <!-- ==================================================
             DIAGNOSTICS
        ================================================== -->

        <div class="otp-diagnostics">

          <h3 class="otp-summary-title">
            Visual Diagnostics
          </h3>


          <div class="otp-diagnostic-row">

            <span class="otp-diagnostic-label">
              Front Centering
            </span>

            <span
              id="res-diag-cfront"
              class="otp-diagnostic-value"
            >
              —
            </span>

          </div>


          <div class="otp-diagnostic-row">

            <span class="otp-diagnostic-label">
              Back Centering
            </span>

            <span
              id="res-diag-cback"
              class="otp-diagnostic-value"
            >
              —
            </span>

          </div>


          <div class="otp-diagnostic-row">

            <span class="otp-diagnostic-label">
              Corner Flaws
            </span>

            <span
              id="res-diag-corners"
              class="otp-diagnostic-value"
            >
              —
            </span>

          </div>


          <div class="otp-diagnostic-row">

            <span class="otp-diagnostic-label">
              Edge Flaws
            </span>

            <span
              id="res-diag-edges"
              class="otp-diagnostic-value"
            >
              —
            </span>

          </div>


          <div class="otp-diagnostic-row">

            <span class="otp-diagnostic-label">
              Surface Flaws
            </span>

            <span
              id="res-diag-surface"
              class="otp-diagnostic-value"
            >
              —
            </span>

          </div>

        </div>


        <!-- ==================================================
             DISCLAIMER
        ================================================== -->

        <div class="otp-disclaimer">

          AI pre-screening estimate only. This tool does not
          provide an official PSA, BGS or ACE grade. Image
          quality, lighting, camera angle and defects hidden
          from the supplied photographs can affect the result.

        </div>

      </div>

    </div>

  </div>

</div>


<script>
(function () {

  "use strict";


  /* ==========================================================
     VERCEL ENDPOINT
  ========================================================== */

  /*
    CHANGE THIS TO YOUR ACTUAL VERCEL URL.

    Example:

    https://your-project.vercel.app/api/grade-card
  */

  const ENDPOINT_URL =
    "https://my-gemini-backend-beta.vercel.app/api/grade-card";


  /* ==========================================================
     ELEMENTS
  ========================================================== */

  const form =
    document.getElementById(
      "card-grader-form"
    );

  const submitButton =
    document.getElementById(
      "grader-submit-btn"
    );

  const buttonText =
    document.getElementById(
      "grader-button-text"
    );

  const loading =
    document.getElementById(
      "grader-loading"
    );

  const loadingText =
    document.getElementById(
      "grader-loading-text"
    );

  const errorBox =
    document.getElementById(
      "grader-error"
    );

  const results =
    document.getElementById(
      "grader-results"
    );

  const frontInput =
    document.getElementById(
      "front-file"
    );

  const backInput =
    document.getElementById(
      "back-file"
    );


  /* ==========================================================
     IMAGE PREVIEW
  ========================================================== */

  function setupPreview(
    input,
    containerId,
    imageId
  ) {

    input.addEventListener(
      "change",
      function (event) {

        const file =
          event.target.files &&
          event.target.files[0];

        if (!file) {
          return;
        }

        const container =
          document.getElementById(
            containerId
          );

        const image =
          document.getElementById(
            imageId
          );

        const reader =
          new FileReader();

        reader.onload =
          function (readerEvent) {

            image.src =
              readerEvent.target.result;

            container.classList.add(
              "visible"
            );
          };

        reader.readAsDataURL(file);
      }
    );
  }


  setupPreview(
    frontInput,
    "front-preview-container",
    "front-preview"
  );


  setupPreview(
    backInput,
    "back-preview-container",
    "back-preview"
  );


  /* ==========================================================
     ERROR
  ========================================================== */

  function showError(message) {

    errorBox.textContent =
      message;

    errorBox.classList.add(
      "visible"
    );
  }


  function clearError() {

    errorBox.textContent =
      "";

    errorBox.classList.remove(
      "visible"
    );
  }


  /* ==========================================================
     SAFE TEXT
  ========================================================== */

  function safeText(
    value,
    fallback = "—"
  ) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {

      return fallback;
    }

    return String(value);
  }


  /* ==========================================================
     ARRAY TO TEXT
  ========================================================== */

  function arrayToText(value) {

    if (
      !Array.isArray(value) ||
      value.length === 0
    ) {

      return "None detected";
    }

    return value.join(
      ", "
    );
  }


  /* ==========================================================
     IMAGE COMPRESSION
  ========================================================== */

  function compressImageAndGetBase64(
    file,
    maxDimension = 1400,
    quality = 0.88
  ) {

    return new Promise(
      function (resolve, reject) {

        const reader =
          new FileReader();

        reader.onload =
          function (event) {

            const image =
              new Image();

            image.onload =
              function () {

                let width =
                  image.width;

                let height =
                  image.height;


                if (
                  width > maxDimension ||
                  height > maxDimension
                ) {

                  if (
                    width > height
                  ) {

                    height =
                      Math.round(
                        (
                          height *
                          maxDimension
                        ) /
                        width
                      );

                    width =
                      maxDimension;

                  } else {

                    width =
                      Math.round(
                        (
                          width *
                          maxDimension
                        ) /
                        height
                      );

                    height =
                      maxDimension;
                  }
                }


                const canvas =
                  document.createElement(
                    "canvas"
                  );

                canvas.width =
                  width;

                canvas.height =
                  height;


                const context =
                  canvas.getContext(
                    "2d"
                  );


                if (!context) {

                  reject(
                    new Error(
                      "Could not process image."
                    )
                  );

                  return;
                }


                context.drawImage(
                  image,
                  0,
                  0,
                  width,
                  height
                );


                const dataUrl =
                  canvas.toDataURL(
                    "image/jpeg",
                    quality
                  );


                resolve(
                  dataUrl.split(
                    ","
                  )[1]
                );
              };


            image.onerror =
              function () {

                reject(
                  new Error(
                    "Could not read image."
                  )
                );
              };


            image.src =
              event.target.result;
          };


        reader.onerror =
          function () {

            reject(
              new Error(
                "Could not read uploaded file."
              )
            );
          };


        reader.readAsDataURL(
          file
        );
      }
    );
  }


  /* ==========================================================
     DISPLAY RESULTS
  ========================================================== */

  function displayResults(data) {

    const card =
      data.cardIdentification ||
      {};

    const predictions =
      data.companyPredictions ||
      {};

    const subgrades =
      data.subgrades ||
      {};

    const recommendation =
      data.recommendation ||
      {};


    /* ========================================================
       CARD
    ======================================================== */

    document.getElementById(
      "result-card-name"
    ).textContent =
      safeText(
        card.cardName
      );


    document.getElementById(
      "result-set-name"
    ).textContent =
      safeText(
        card.setName
      );


    document.getElementById(
      "result-card-number"
    ).textContent =
      safeText(
        card.cardNumber
      );


    document.getElementById(
      "result-rarity"
    ).textContent =
      safeText(
        card.rarity
      );


    document.getElementById(
      "result-language"
    ).textContent =
      safeText(
        card.language
      );


    document.getElementById(
      "result-variant"
    ).textContent =
      safeText(
        card.variant
      );


    document.getElementById(
      "result-id-confidence"
    ).textContent =
      safeText(
        card.identificationConfidence
      );


    /* ========================================================
       PSA
    ======================================================== */

    const psa =
      predictions.PSA ||
      {};


    document.getElementById(
      "res-psa-grade"
    ).textContent =
      safeText(
        psa.predictedGrade
      );


    document.getElementById(
      "res-psa-confidence"
    ).textContent =
      safeText(
        psa.confidence
      );


    document.getElementById(
      "res-psa-reason"
    ).textContent =
      safeText(
        psa.reasoning,
        "No reasoning supplied."
      );


    /* ========================================================
       BGS
    ======================================================== */

    const bgs =
      predictions.BGS ||
      {};

    const bgsSubs =
      bgs.estimatedSubgrades ||
      {};


    document.getElementById(
      "res-bgs-grade"
    ).textContent =
      safeText(
        bgs.predictedGrade
      );


    document.getElementById(
      "res-bgs-confidence"
    ).textContent =
      safeText(
        bgs.confidence
      );


    document.getElementById(
      "res-bgs-subs"
    ).textContent =

      "Centering: " +
      safeText(
        bgsSubs.centering
      ) +

      " | Corners: " +
      safeText(
        bgsSubs.corners
      ) +

      " | Edges: " +
      safeText(
        bgsSubs.edges
      ) +

      " | Surface: " +
      safeText(
        bgsSubs.surface
      );


    document.getElementById(
      "res-bgs-reason"
    ).textContent =
      safeText(
        bgs.reasoning,
        "No reasoning supplied."
      );


    /* ========================================================
       ACE
    ======================================================== */

    const ace =
      predictions.ACE ||
      {};


    document.getElementById(
      "res-ace-grade"
    ).textContent =
      safeText(
        ace.predictedGrade
      );


    document.getElementById(
      "res-ace-confidence"
    ).textContent =
      safeText(
        ace.confidence
      );


    document.getElementById(
      "res-ace-reason"
    ).textContent =
      safeText(
        ace.reasoning,
        "No reasoning supplied."
      );


    /* ========================================================
       SUMMARY
    ======================================================== */

    document.getElementById(
      "res-grade-summary"
    ).textContent =
      safeText(
        data.gradeSummary,
        "No grade summary was returned."
      );


    /* ========================================================
       DIAGNOSTICS
    ======================================================== */

    document.getElementById(
      "res-diag-cfront"
    ).textContent =
      safeText(
        subgrades.centeringFront
      );


    document.getElementById(
      "res-diag-cback"
    ).textContent =
      safeText(
        subgrades.centeringBack
      );


    document.getElementById(
      "res-diag-corners"
    ).textContent =
      arrayToText(
        subgrades.cornersFlaws
      );


    document.getElementById(
      "res-diag-edges"
    ).textContent =
      arrayToText(
        subgrades.edgesFlaws
      );


    document.getElementById(
      "res-diag-surface"
    ).textContent =
      arrayToText(
        subgrades.surfaceFlaws
      );


    /* ========================================================
       RECOMMENDATION
    ======================================================== */

    document.getElementById(
      "recommended-service"
    ).textContent =
      safeText(
        recommendation.service,
        "Unable to recommend"
      );


    document.getElementById(
      "recommendation-grade"
    ).textContent =

      recommendation.predictedGrade
        ? "Predicted grade: " +
          recommendation.predictedGrade
        : "";


    document.getElementById(
      "recommendation-verdict"
    ).textContent =
      safeText(
        recommendation.verdict,
        "Unable to recommend"
      );


    document.getElementById(
      "recommendation-reason"
    ).textContent =
      safeText(
        recommendation.reason,
        "No recommendation reasoning supplied."
      );


    /* ========================================================
       SHOW
    ======================================================== */

    results.classList.add(
      "visible"
    );


    setTimeout(
      function () {

        results.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      },
      100
    );
  }


  /* ==========================================================
     SUBMIT
  ========================================================== */

  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();

      clearError();


      const frontFile =
        frontInput.files &&
        frontInput.files[0];

      const backFile =
        backInput.files &&
        backInput.files[0];


      if (!frontFile) {

        showError(
          "Please upload the front of your card."
        );

        return;
      }


      if (!backFile) {

        showError(
          "Please upload the back of your card."
        );

        return;
      }


      if (
        !frontFile.type.startsWith(
          "image/"
        )
      ) {

        showError(
          "The front file must be an image."
        );

        return;
      }


      if (
        !backFile.type.startsWith(
          "image/"
        )
      ) {

        showError(
          "The back file must be an image."
        );

        return;
      }


      /* ------------------------------------------------------
         LOADING
      ------------------------------------------------------ */

      submitButton.disabled =
        true;

      buttonText.style.display =
        "none";

      loading.classList.add(
        "visible"
      );


      try {

        loadingText.textContent =
          "Optimizing images...";


        const frontBase64 =
          await compressImageAndGetBase64(
            frontFile
          );


        const backBase64 =
          await compressImageAndGetBase64(
            backFile
          );


        loadingText.textContent =
          "Identifying card...";


        const response =
          await fetch(
            ENDPOINT_URL,
            {

              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify({

                  frontBase64,

                  backBase64,

                  frontMimeType:
                    "image/jpeg",

                  backMimeType:
                    "image/jpeg"

                })

            }
          );


        if (!response.ok) {

          let message =
            `Server error (${response.status})`;

          try {

            const errorData =
              await response.json();

            if (
              errorData &&
              errorData.error
            ) {

              message =
                errorData.error;
            }

          } catch (ignored) {}

          throw new Error(
            message
          );
        }


        loadingText.textContent =
          "Evaluating condition...";


        const data =
          await response.json();


        if (
          !data ||
          !data.companyPredictions
        ) {

          throw new Error(
            "The grading service returned an incomplete response."
          );
        }


        loadingText.textContent =
          "Preparing report...";


        displayResults(
          data
        );


      } catch (error) {

        console.error(
          "Card grading error:",
          error
        );

        showError(
          "Error evaluating card: " +
          (
            error?.message ||
            "Unknown error."
          )
        );


      } finally {

        submitButton.disabled =
          false;

        buttonText.style.display =
          "";

        loading.classList.remove(
          "visible"
        );

        loadingText.textContent =
          "Analyzing card...";

      }

    }
  );

})();
</script>
