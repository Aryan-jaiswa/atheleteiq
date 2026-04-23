import { PrismaClient, Role, DominantSide, VideoType, VideoStatus, SelectionDecision } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Helper to generate realistic MediaPipe 33-keypoint data
 */
function generateKeypointSeries(frameCount: number) {
  const series: any[] = [];
  for (let frame = 0; frame < frameCount; frame++) {
    const keypoints: any = {};
    const keypointNames = [
      'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
      'right_eye_inner', 'right_eye', 'right_eye_outer',
      'left_ear', 'right_ear',
      'mouth_left', 'mouth_right',
      'left_shoulder', 'right_shoulder',
      'left_elbow', 'right_elbow',
      'left_wrist', 'right_wrist',
      'left_pinky_1', 'right_pinky_1',
      'left_index_1', 'right_index_1',
      'left_thumb_2', 'right_thumb_2',
      'left_hip', 'right_hip',
      'left_knee', 'right_knee',
      'left_ankle', 'right_ankle',
      'left_heel', 'right_heel',
      'left_foot_index', 'right_foot_index'
    ];

    keypointNames.forEach((name) => {
      keypoints[name] = [
        Math.random() * 640,  // x
        Math.random() * 480,  // y
        Math.random() * 0.9 + 0.1  // confidence
      ];
    });
    series.push(keypoints);
  }
  return series;
}

/**
 * Helper to generate frame timestamps
 */
function generateFrameTimestamps(frameCount: number, fps: number = 30) {
  const timestamps: number[] = [];
  for (let i = 0; i < frameCount; i++) {
    timestamps.push((i / fps) * 1000); // convert to ms
  }
  return timestamps;
}

async function main() {
  console.log('🌱 Starting seed data generation...');

  // Clear existing data (optional - comment out if you want to append)
  // await prisma.selectionReport.deleteMany();
  // await prisma.geminiAnalysis.deleteMany();
  // await prisma.biomechanicsReport.deleteMany();
  // await prisma.poseAnalysis.deleteMany();
  // await prisma.video.deleteMany();
  // await prisma.scoutWatchlist.deleteMany();
  // await prisma.coachAthleteLink.deleteMany();
  // await prisma.athleteProfile.deleteMany();
  // await prisma.user.deleteMany();

  console.log('📝 Creating Scout and Federation Admin users...');
  const scout = await prisma.user.create({
    data: {
      name: 'John Scout',
      email: 'scout@athleteiq.com',
      phone: '+1-555-0101',
      role: Role.SCOUT,
      region: 'West Coast',
      state: 'CA',
    },
  });

  const federationAdmin = await prisma.user.create({
    data: {
      name: 'Federation Admin',
      email: 'admin@federation.org',
      phone: '+1-555-0102',
      role: Role.FEDERATION,
      region: 'National',
      state: 'NY',
    },
  });

  const coach = await prisma.user.create({
    data: {
      name: 'Mike Coach',
      email: 'coach@athleteiq.com',
      phone: '+1-555-0103',
      role: Role.COACH,
      region: 'Midwest',
      state: 'IL',
    },
  });

  console.log('👨‍🦱 Creating 5 Athletes with complete profiles...');
  const athletesData = [
    {
      name: 'Alice Springer',
      email: 'alice.springer@example.com',
      sport: 'Track and Field',
      bio: 'Elite 100m sprinter with exceptional acceleration',
      dateOfBirth: new Date('2000-03-15'),
      height: 178,
      weight: 68,
      region: 'West Coast',
      state: 'CA',
    },
    {
      name: 'Bob Jumper',
      email: 'bob.jumper@example.com',
      sport: 'Long Jump',
      bio: 'Explosive athlete with powerful leg drive',
      dateOfBirth: new Date('1999-07-22'),
      height: 185,
      weight: 75,
      region: 'Midwest',
      state: 'MI',
    },
    {
      name: 'Charlie Kicks',
      email: 'charlie.kicks@example.com',
      sport: 'Soccer',
      bio: 'Agile striker with high game intelligence',
      dateOfBirth: new Date('2002-11-08'),
      height: 175,
      weight: 70,
      region: 'South',
      state: 'TX',
    },
    {
      name: 'Diana Throws',
      email: 'diana.throws@example.com',
      sport: 'Javelin',
      bio: 'Strong technical thrower with excellent form',
      dateOfBirth: new Date('2001-05-19'),
      height: 182,
      weight: 72,
      region: 'Northeast',
      state: 'PA',
    },
    {
      name: 'Evan Blocks',
      email: 'evan.blocks@example.com',
      sport: 'Volleyball',
      bio: 'Middle blocker with powerful vertical jump',
      dateOfBirth: new Date('2000-09-03'),
      height: 195,
      weight: 88,
      region: 'West Coast',
      state: 'WA',
    },
  ];

  const createdAthletes = [];

  for (let i = 0; i < athletesData.length; i++) {
    const data = athletesData[i];
    console.log(`  Creating athlete: ${data.name}`);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        role: Role.ATHLETE,
        sport: data.sport,
        region: data.region,
        state: data.state,
        athleteProfile: {
          create: {
            sport: data.sport,
            dateOfBirth: data.dateOfBirth,
            height: data.height,
            weight: data.weight,
            dominantSide: i % 2 === 0 ? DominantSide.RIGHT : DominantSide.LEFT,
            region: data.region,
            state: data.state,
            bio: data.bio,
            profilePhotoUrl: `https://storage.googleapis.com/athleteiq-images/profile_${i}.jpg`,
            overallScore: 70 + i * 3 + Math.random() * 10,
            selectionEligible: i < 4, // First 4 are eligible
          },
        },
      },
      include: { athleteProfile: true },
    });
    createdAthletes.push(user);
  }

  console.log('🎥 Creating Videos with Pose Analysis, Biomechanics, and Gemini Analysis...');

  const videoIds: string[] = [];

  for (let i = 0; i < createdAthletes.length; i++) {
    const athlete = createdAthletes[i];
    const profile = athlete.athleteProfile!;

    // Create 2 videos per athlete for better analysis
    for (let vidIdx = 0; vidIdx < 2; vidIdx++) {
      console.log(`  Creating video ${vidIdx + 1} for ${athlete.name}`);

      const frameCount = 300 + i * 50; // Varying frame counts
      const fps = 30;

      const video = await prisma.video.create({
        data: {
          athleteId: profile.id,
          uploadedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
          gcsRawUrl: `gs://athleteiq-videos/${profile.id}/raw_${vidIdx}.mp4`,
          type: vidIdx === 0 ? VideoType.TRAINING : VideoType.MATCH,
          sport: profile.sport,
          durationSeconds: frameCount / fps,
          status: VideoStatus.COMPLETE,
          frameCount: frameCount,
          processedAt: new Date(),
          uploaderId: scout.id,
        },
      });

      videoIds.push(video.id);

      // --- Pose Analysis ---
      console.log(`    Creating pose analysis for video ${video.id.substring(0, 8)}...`);
      const frameTimestamps = generateFrameTimestamps(frameCount, fps);
      const keypointSeries = generateKeypointSeries(frameCount);

      await prisma.poseAnalysis.create({
        data: {
          videoId: video.id,
          frameTimestamps: frameTimestamps,
          keypointSeries: keypointSeries,
          extractionDurationMs: 2000 + Math.random() * 3000,
        },
      });

      // --- Biomechanics Report ---
      console.log(`    Creating biomechanics report...`);
      const jointAngles = {
        knee_flexion_left: { min: 35, max: 150, avg: 92 },
        knee_flexion_right: { min: 32, max: 155, avg: 94 },
        hip_angle: { min: 60, max: 120, avg: 95 },
        shoulder_angle: { min: 45, max: 170, avg: 110 },
        elbow_angle: { min: 50, max: 160, avg: 115 },
      };

      const velocityMetrics = {
        stride_velocity: 8.5 + Math.random() * 2,
        arm_swing_velocity: 5.2 + Math.random() * 1.5,
        center_of_mass_velocity: 4.8 + Math.random() * 1.2,
      };

      const accelerationMetrics = {
        peak_acceleration: 15.2 + Math.random() * 5,
        deceleration_patterns: 'Smooth with controlled landing',
      };

      await prisma.biomechanicsReport.create({
        data: {
          videoId: video.id,
          athleteId: profile.id,
          jointAngles: jointAngles,
          velocityMetrics: velocityMetrics,
          accelerationMetrics: accelerationMetrics,
          symmetryScore: 82 + Math.random() * 12,
          balanceScore: 85 + Math.random() * 10,
          reactionTime: 110 + Math.random() * 30,
          explosiveness: 78 + Math.random() * 15,
          enduranceIndex: 80 + Math.random() * 15,
          techniqueScore: 81 + Math.random() * 14,
          sport: profile.sport,
        },
      });

      // --- Gemini Analysis ---
      console.log(`    Creating Gemini AI analysis...`);
      const strengths = [
        'Excellent explosiveness and power generation',
        'Good kinetic chain efficiency',
        'Strong core stability',
        'Impressive acceleration patterns',
      ];
      const weaknesses = [
        'Minor asymmetry in right leg landing',
        'Could improve ankle flexibility',
      ];

      await prisma.geminiAnalysis.create({
        data: {
          videoId: video.id,
          athleteId: profile.id,
          modelVersion: 'gemini-2.0-pro',
          rawPrompt: `Analyze the biomechanics and movement patterns for a ${profile.sport} athlete during ${vidIdx === 0 ? 'training' : 'match'} session.`,
          rawResponse: `Analysis complete for athlete in ${profile.sport}. Detailed metrics extracted and evaluated.`,
          strengths: strengths,
          weaknesses: weaknesses,
          tacticalIntelligence: `Strong game awareness. Positions well for defensive plays and transitions smoothly between offensive and defensive actions.`,
          movementEfficiency: `Highly efficient kinetic chain. Energy transfer from lower to upper body is optimal. Ground contact time is within elite standards.`,
          coachNotes: `Focus on unilateral leg strengthening to eliminate minor asymmetry. Consider additional ankle mobility work. Overall movement quality is excellent.`,
          injuryRiskScore: 22 + Math.random() * 15,
          injuryRiskAreas: i % 2 === 0 ? ['Right ankle'] : ['Left knee'],
          aiSummary: `${athlete.name} demonstrates elite-level movement patterns with exceptional power output. The athlete's technique is well-developed with minor asymmetries that are easily correctable. Strong selection candidate pending additional evaluation metrics.`,
        },
      });
    }
  }

  console.log('📊 Creating Selection Reports...');

  // Selection Report 1: SELECTED athlete
  const video1 = await prisma.video.findFirst({
    where: { athleteId: createdAthletes[0].athleteProfile!.id },
  });

  const report1 = await prisma.selectionReport.create({
    data: {
      athleteId: createdAthletes[0].athleteProfile!.id,
      generatedById: federationAdmin.id,
      generatedAt: new Date(),
      compositeScore: 89.5,
      selectionDecision: SelectionDecision.SELECTED,
      decisionReason:
        'Exceptional biomechanical efficiency, excellent technique scores, and low injury risk profile. Clear standout performer across all metrics.',
      videoIds: video1 ? [video1.id] : [],
      reportPdfUrl: 'gs://athleteiq-reports/report_selected_alice.pdf',
    },
  });

  // Selection Report 2: WAITLISTED athlete
  const video2 = await prisma.video.findFirst({
    where: { athleteId: createdAthletes[1].athleteProfile!.id },
  });

  const report2 = await prisma.selectionReport.create({
    data: {
      athleteId: createdAthletes[1].athleteProfile!.id,
      generatedById: scout.id,
      generatedAt: new Date(),
      compositeScore: 76.5,
      selectionDecision: SelectionDecision.WAITLISTED,
      decisionReason:
        'Strong potential with good explosiveness scores. Recommend additional evaluation focused on symmetry improvement and injury risk mitigation before final selection.',
      videoIds: video2 ? [video2.id] : [],
      reportPdfUrl: 'gs://athleteiq-reports/report_waitlisted_bob.pdf',
    },
  });

  console.log('🔗 Creating Coach-Athlete Links and Scout Watchlist...');

  // Link coach to athletes
  await prisma.coachAthleteLink.create({
    data: {
      coachId: coach.id,
      athleteId: createdAthletes[0].athleteProfile!.id,
    },
  });

  await prisma.coachAthleteLink.create({
    data: {
      coachId: coach.id,
      athleteId: createdAthletes[1].athleteProfile!.id,
    },
  });

  // Add athletes to scout watchlist
  await prisma.scoutWatchlist.create({
    data: {
      scoutId: scout.id,
      athleteId: createdAthletes[0].athleteProfile!.id,
      notes: 'Elite prospect. Track for national team selection.',
    },
  });

  await prisma.scoutWatchlist.create({
    data: {
      scoutId: scout.id,
      athleteId: createdAthletes[2].athleteProfile!.id,
      notes: 'Good technical skills. Monitor for development.',
    },
  });

  console.log('✅ Seed completed successfully!');
  console.log(`   - Created ${createdAthletes.length} athletes with profiles`);
  console.log(`   - Created ${videoIds.length} videos with analysis data`);
  console.log(`   - Created 2 selection reports`);
  console.log(`   - Created coach-athlete and scout watchlist links`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
