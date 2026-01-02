"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { secureFetch } from "@/lib/api-client";
import {
  GameSelectionStep,
  BasicInfoStep,
  ScheduleStep,
  RulesStep,
  PreviewStep,
  WizardProgress,
  BasicInfoData,
  ScheduleData,
  RulesData,
} from "@/components/tournament-wizard";
import { getGameDefaults, generateSmartDates } from "@/lib/game-defaults";

const WIZARD_STEPS = [
  { id: 1, name: "Game", icon: "🎮" },
  { id: 2, name: "Details", icon: "📋" },
  { id: 3, name: "Schedule", icon: "📅" },
  { id: 4, name: "Rules", icon: "📜" },
  { id: 5, name: "Preview", icon: "👁️" },
];

interface WizardFormData {
  game_type: string;
  basicInfo: BasicInfoData;
  schedule: ScheduleData;
  rules: RulesData;
}

export default function CreateTournamentWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const [formData, setFormData] = useState<WizardFormData>({
    game_type: "freefire",
    basicInfo: {
      tournament_name: "",
      tournament_type: "solo",
      max_teams: 48,
      entry_fee: 0,
      prize_pool: 500,
      map_name: "Bermuda",
    },
    schedule: {
      registration_start_date: "",
      registration_end_date: "",
      tournament_start_date: "",
      tournament_end_date: "",
      schedule_type: "once",
      publish_time: "",
    },
    rules: {
      description: "",
      match_rules: "",
    },
  });

  // Check authorization
  useEffect(() => {
    secureFetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          const userData = data.data;
          if (!userData.is_host && !userData.is_admin) {
            router.push("/dashboard");
          } else {
            setIsAuthorized(true);
          }
        } else {
          router.push("/login");
        }
      })
      .catch(() => {
        router.push("/login");
      });
  }, [router]);

  // Apply game defaults when game changes
  const handleGameChange = (game: string) => {
    const defaults = getGameDefaults(game);
    const smartDates = generateSmartDates(game);
    const firstType = defaults.tournament_types[0];

    setFormData({
      game_type: game,
      basicInfo: {
        tournament_name: "",
        tournament_type: firstType.type,
        max_teams: firstType.max_teams,
        entry_fee: 0,
        prize_pool: defaults.prize_pool_suggestions[2] || 500,
        map_name: defaults.default_map,
      },
      schedule: {
        ...smartDates,
        schedule_type: "once",
        publish_time: "",
      },
      rules: {
        description: defaults.default_description,
        match_rules: defaults.default_rules,
      },
    });
  };

  const updateBasicInfo = (data: Partial<BasicInfoData>) => {
    setFormData((prev) => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, ...data },
    }));
    // Clear errors for updated fields
    const clearedErrors = { ...errors };
    Object.keys(data).forEach((key) => delete clearedErrors[key]);
    setErrors(clearedErrors);
  };

  const updateSchedule = (data: Partial<ScheduleData>) => {
    setFormData((prev) => ({
      ...prev,
      schedule: { ...prev.schedule, ...data },
    }));
    const clearedErrors = { ...errors };
    Object.keys(data).forEach((key) => delete clearedErrors[key]);
    setErrors(clearedErrors);
  };

  const updateRules = (data: Partial<RulesData>) => {
    setFormData((prev) => ({
      ...prev,
      rules: { ...prev.rules, ...data },
    }));
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 2: // Basic Info
        if (!formData.basicInfo.tournament_name.trim()) {
          newErrors.tournament_name = "Tournament name is required";
        } else if (formData.basicInfo.tournament_name.length < 3) {
          newErrors.tournament_name = "Tournament name must be at least 3 characters";
        }
        if (formData.basicInfo.max_teams < 2) {
          newErrors.max_teams = "Must have at least 2 participants";
        }
        break;

      case 3: // Schedule
        const { registration_start_date, registration_end_date, tournament_start_date, tournament_end_date, schedule_type, publish_time } = formData.schedule;
        
        if (!registration_start_date) newErrors.registration_start_date = "Required";
        if (!registration_end_date) newErrors.registration_end_date = "Required";
        if (!tournament_start_date) newErrors.tournament_start_date = "Required";
        if (!tournament_end_date) newErrors.tournament_end_date = "Required";

        if (registration_start_date && registration_end_date) {
          if (new Date(registration_start_date) >= new Date(registration_end_date)) {
            newErrors.registration_end_date = "Must be after registration start";
          }
        }

        if (registration_end_date && tournament_start_date) {
          if (new Date(registration_end_date) >= new Date(tournament_start_date)) {
            newErrors.tournament_start_date = "Must be after registration end";
          }
        }

        if (tournament_start_date && tournament_end_date) {
          if (new Date(tournament_start_date) >= new Date(tournament_end_date)) {
            newErrors.tournament_end_date = "Must be after tournament start";
          }
        }

        if (schedule_type === "everyday" && !publish_time) {
          newErrors.publish_time = "Daily publish time is required";
        }
        break;

      case 4: // Rules & Description
        if (!formData.rules.description.trim()) {
          newErrors.description = "Description is required";
        } else if (formData.rules.description.length < 20) {
          newErrors.description = "Description must be at least 20 characters";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length) {
      if (validateCurrentStep()) {
        setCurrentStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setMessage(null);

    const payload = {
      tournament_name: formData.basicInfo.tournament_name,
      game_type: formData.game_type,
      tournament_type: formData.basicInfo.tournament_type,
      max_teams: formData.basicInfo.max_teams,
      entry_fee: formData.basicInfo.entry_fee,
      prize_pool: formData.basicInfo.prize_pool,
      map_name: formData.basicInfo.map_name,
      description: formData.rules.description,
      match_rules: formData.rules.match_rules,
      registration_start_date: formData.schedule.registration_start_date,
      registration_end_date: formData.schedule.registration_end_date,
      tournament_start_date: formData.schedule.tournament_start_date,
      tournament_end_date: formData.schedule.tournament_end_date,
      schedule_type: formData.schedule.schedule_type,
      publish_time: formData.schedule.publish_time || null,
    };

    try {
      const res = await secureFetch("/api/tournaments", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Tournament created successfully!" });
        setTimeout(() => {
          router.push("/admin");
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.message || "Failed to create tournament" });
      }
    } catch {
      setMessage({ type: "error", text: "An error occurred. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Admin
          </Link>
          <h1 className="font-bold text-gray-900 dark:text-white">Create Tournament</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <WizardProgress
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            allowNavigation
            onStepClick={(step) => {
              if (step < currentStep) setCurrentStep(step);
            }}
          />
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-xl ${
              message.type === "success"
                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 md:p-8">
          {currentStep === 1 && (
            <GameSelectionStep
              selectedGame={formData.game_type}
              onSelectGame={handleGameChange}
            />
          )}

          {currentStep === 2 && (
            <BasicInfoStep
              gameType={formData.game_type}
              data={formData.basicInfo}
              onChange={updateBasicInfo}
              errors={errors}
            />
          )}

          {currentStep === 3 && (
            <ScheduleStep
              gameType={formData.game_type}
              data={formData.schedule}
              onChange={updateSchedule}
              errors={errors}
            />
          )}

          {currentStep === 4 && (
            <RulesStep
              gameType={formData.game_type}
              data={formData.rules}
              onChange={updateRules}
              errors={errors}
            />
          )}

          {currentStep === 5 && (
            <PreviewStep
              gameType={formData.game_type}
              basicInfo={formData.basicInfo}
              schedule={formData.schedule}
              rules={formData.rules}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-6 py-3 rounded-xl font-medium transition flex items-center gap-2
              ${currentStep === 1
                ? "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {currentStep < WIZARD_STEPS.length ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white 
                       rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 
                       transition flex items-center gap-2 shadow-lg"
            >
              Next
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white 
                       rounded-xl font-medium hover:from-green-600 hover:to-emerald-700 
                       transition flex items-center gap-2 shadow-lg disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Publishing...
                </>
              ) : (
                <>
                  🚀 Publish Tournament
                </>
              )}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
