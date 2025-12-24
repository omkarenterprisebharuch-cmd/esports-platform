"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Team } from "@/types";

interface TeamMember {
  id: number;
  user_id: number;
  role: string;
  username: string;
  avatar_url: string | null;
}

export default function TeamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");

    // Get current user
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setCurrentUserId(data.data.user.id);
        }
      });

    // Get team details
    fetch(`/api/teams/${params.teamId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTeam(data.data.team);
          setMembers(data.data.members || []);
        }
      })
      .finally(() => setLoading(false));
  }, [params.teamId]);

  const handleLeaveTeam = async () => {
    if (!confirm("Are you sure you want to leave this team?")) return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/teams/${params.teamId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push("/my-teams");
      }
    } catch (error) {
      console.error("Failed to leave team:", error);
    }
  };

  const handleDeleteTeam = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this team? This action cannot be undone."
      )
    )
      return;

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`/api/teams/${params.teamId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        router.push("/my-teams");
      }
    } catch (error) {
      console.error("Failed to delete team:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Team not found</p>
      </div>
    );
  }

  const isOwner = team.owner_id === currentUserId;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team.team_name}</h1>
            <p className="text-gray-500">
              Created {new Date(team.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Invite Code</p>
            <p className="font-mono text-lg font-bold text-gray-900">
              {team.invite_code}
            </p>
          </div>
        </div>

        {team.description && (
          <p className="text-gray-600 mb-6">{team.description}</p>
        )}

        <div className="border-t border-gray-100 pt-6">
          <h2 className="font-semibold text-gray-900 mb-4">
            Team Members ({members.length})
          </h2>

          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-semibold">
                    {member.username?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{member.username}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {member.role}
                    </p>
                  </div>
                </div>

                {member.role === "owner" && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                    Owner
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        {isOwner ? (
          <button
            onClick={handleDeleteTeam}
            className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition"
          >
            Delete Team
          </button>
        ) : (
          <button
            onClick={handleLeaveTeam}
            className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition"
          >
            Leave Team
          </button>
        )}
      </div>
    </div>
  );
}
