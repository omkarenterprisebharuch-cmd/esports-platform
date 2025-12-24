"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Team {
  id: number;
  team_name: string;
  team_code: string;
  total_members: number;
  max_members: number;
  role: string;
  game_uid: string;
  game_name: string;
  captain_name: string;
  is_captain: boolean;
  created_at: string;
}

export default function MyTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = () => {
    const token = localStorage.getItem("token");
    fetch("/api/teams/my-teams", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTeams(data.data.teams || []);
        }
      })
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Teams</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
          >
            Join Team
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition"
          >
            Create Team
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-5xl mb-4">👥</p>
          <p className="text-gray-500 mb-2">You don't have any teams yet</p>
          <p className="text-sm text-gray-400">
            Create a new team or join an existing one
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <Link key={team.id} href={`/team/${team.id}`}>
              <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {team.team_name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Captain: {team.captain_name}
                    </p>
                  </div>
                  {team.is_captain && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded">
                      Captain
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {team.total_members}/{team.max_members} Members
                  </span>
                  <span className="font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                    #{team.team_code}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTeams();
          }}
        />
      )}

      {/* Join Team Modal */}
      {showJoinModal && (
        <JoinTeamModal
          onClose={() => setShowJoinModal(false)}
          onSuccess={() => {
            setShowJoinModal(false);
            fetchTeams();
          }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    team_name: "",
    game_uid: "",
    game_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.message || "Failed to create team");
      }
    } catch {
      setError("Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create Team</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Name
            </label>
            <input
              type="text"
              value={form.team_name}
              onChange={(e) => setForm({ ...form, team_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game UID
            </label>
            <input
              type="text"
              value={form.game_uid}
              onChange={(e) => setForm({ ...form, game_uid: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game Name
            </label>
            <input
              type="text"
              value={form.game_name}
              onChange={(e) => setForm({ ...form, game_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JoinTeamModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    invite_code: "",
    game_uid: "",
    game_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const token = localStorage.getItem("token");

    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setError(data.message || "Failed to join team");
      }
    } catch {
      setError("Failed to join team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Join Team</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Team Invite Code
            </label>
            <input
              type="text"
              value={form.invite_code}
              onChange={(e) =>
                setForm({ ...form, invite_code: e.target.value })
              }
              placeholder="12345"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none text-center text-xl font-mono tracking-widest"
              maxLength={5}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game UID
            </label>
            <input
              type="text"
              value={form.game_uid}
              onChange={(e) => setForm({ ...form, game_uid: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your In-Game Name
            </label>
            <input
              type="text"
              value={form.game_name}
              onChange={(e) => setForm({ ...form, game_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Joining..." : "Join"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
