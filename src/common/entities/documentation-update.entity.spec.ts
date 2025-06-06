import { DocumentationUpdate } from './documentation-update.entity';

describe('DocumentationUpdate Entity', () => {
  let documentationUpdate: DocumentationUpdate;

  const mockAnalysisResult = {
    shouldUpdate: true,
    confidence: 85,
    reasoning: 'Significant API changes detected',
    suggestedUpdates: {
      readme: {
        shouldUpdate: true,
        sections: ['API', 'Usage'],
        priority: 'high' as const,
        suggestedContent: 'Update API section',
      },
      apiDocs: {
        shouldUpdate: true,
        affectedEndpoints: ['/api/test'],
        priority: 'high' as const,
        suggestedContent: 'Update endpoint documentation',
      },
      changelog: {
        shouldUpdate: true,
        entryType: 'minor' as const,
        priority: 'medium' as const,
        suggestedEntry: 'Added new test endpoint',
      },
    },
    metadata: {
      analysisDate: '2024-01-01T00:00:00Z',
      llmModel: 'gpt-4',
      processingTime: 1500,
    },
  };

  beforeEach(() => {
    documentationUpdate = new DocumentationUpdate();
    documentationUpdate.id = 'doc-update-123';
    documentationUpdate.repositoryId = 'repo-123';
    documentationUpdate.syncJobId = 'sync-job-123';
    documentationUpdate.status = 'pending';
    documentationUpdate.priority = 'medium';
    documentationUpdate.updateType = 'multiple';
    documentationUpdate.confidence = 85;
    documentationUpdate.reasoning = 'Significant API changes detected';
    // Create a deep copy of mockAnalysisResult to prevent mutations
    documentationUpdate.analysisResult = JSON.parse(JSON.stringify(mockAnalysisResult));
    documentationUpdate.changeContext = {
      commits: {
        from: 'abc123',
        to: 'def456',
        count: 3,
      },
      changes: {
        added: 2,
        modified: 1,
        deleted: 0,
      },
      complexity: {
        average: 5.5,
        highest: 12,
      },
    };
    documentationUpdate.createdAt = new Date('2024-01-01T00:00:00Z');
    documentationUpdate.updatedAt = new Date('2024-01-01T00:00:00Z');
  });

  describe('Basic Properties', () => {
    it('should have all required properties', () => {
      expect(documentationUpdate.id).toBe('doc-update-123');
      expect(documentationUpdate.repositoryId).toBe('repo-123');
      expect(documentationUpdate.status).toBe('pending');
      expect(documentationUpdate.priority).toBe('medium');
      expect(documentationUpdate.updateType).toBe('multiple');
      expect(documentationUpdate.confidence).toBe(85);
      expect(documentationUpdate.reasoning).toBe('Significant API changes detected');
    });

    it('should have proper default values', () => {
      const newUpdate = new DocumentationUpdate();
      expect(newUpdate.status).toBeUndefined(); // Will be set by entity default
      expect(newUpdate.priority).toBeUndefined(); // Will be set by entity default
      expect(newUpdate.confidence).toBeUndefined(); // Will be set by entity default
    });
  });

  describe('Helper Methods', () => {
    describe('isOverdue', () => {
      it('should return false when no due date is set', () => {
        documentationUpdate.dueDate = undefined;
        expect(documentationUpdate.isOverdue).toBe(false);
      });

      it('should return true when due date is in the past', () => {
        documentationUpdate.dueDate = new Date('2023-12-31T00:00:00Z');
        expect(documentationUpdate.isOverdue).toBe(true);
      });

      it('should return false when due date is in the future', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        documentationUpdate.dueDate = futureDate;
        expect(documentationUpdate.isOverdue).toBe(false);
      });
    });

    describe('isPending', () => {
      it('should return true when status is pending', () => {
        documentationUpdate.status = 'pending';
        expect(documentationUpdate.isPending).toBe(true);
      });

      it('should return false when status is not pending', () => {
        documentationUpdate.status = 'completed';
        expect(documentationUpdate.isPending).toBe(false);
      });
    });

    describe('isCompleted', () => {
      it('should return true when status is completed', () => {
        documentationUpdate.status = 'completed';
        expect(documentationUpdate.isCompleted).toBe(true);
      });

      it('should return false when status is not completed', () => {
        documentationUpdate.status = 'pending';
        expect(documentationUpdate.isCompleted).toBe(false);
      });
    });

    describe('priorityScore', () => {
      it('should calculate priority score correctly for high priority', () => {
        documentationUpdate.priority = 'high';
        documentationUpdate.confidence = 80;
        expect(documentationUpdate.priorityScore).toBe(3 * 0.8); // 2.4
      });

      it('should calculate priority score correctly for medium priority', () => {
        documentationUpdate.priority = 'medium';
        documentationUpdate.confidence = 75;
        expect(documentationUpdate.priorityScore).toBe(2 * 0.75); // 1.5
      });

      it('should calculate priority score correctly for low priority', () => {
        documentationUpdate.priority = 'low';
        documentationUpdate.confidence = 60;
        expect(documentationUpdate.priorityScore).toBe(1 * 0.6); // 0.6
      });
    });

    describe('estimatedEffort', () => {
      it('should return large for multiple updates or high priority', () => {
        documentationUpdate.priority = 'high';
        expect(documentationUpdate.estimatedEffort).toBe('large');
      });

      it('should return large for 3 or more updates', () => {
        documentationUpdate.priority = 'medium';
        // All three types should update (readme, apiDocs, changelog)
        expect(documentationUpdate.estimatedEffort).toBe('large');
      });

      it('should return medium for 2 updates or medium priority', () => {
        documentationUpdate.priority = 'medium';
        documentationUpdate.analysisResult.suggestedUpdates.readme!.shouldUpdate = false;
        expect(documentationUpdate.estimatedEffort).toBe('medium');
      });

      it('should return small for single update with low priority', () => {
        documentationUpdate.priority = 'low';
        documentationUpdate.analysisResult.suggestedUpdates.readme!.shouldUpdate = false;
        documentationUpdate.analysisResult.suggestedUpdates.apiDocs!.shouldUpdate = false;
        expect(documentationUpdate.estimatedEffort).toBe('small');
      });
    });
  });

  describe('Status Management', () => {
    describe('updateStatus', () => {
      it('should update status without additional parameters', () => {
        documentationUpdate.updateStatus('in_progress');
        expect(documentationUpdate.status).toBe('in_progress');
        expect(documentationUpdate.completedAt).toBeUndefined();
      });

      it('should set completed date when status is completed', () => {
        const beforeUpdate = new Date();
        documentationUpdate.updateStatus('completed');
        const afterUpdate = new Date();

        expect(documentationUpdate.status).toBe('completed');
        expect(documentationUpdate.completedAt).toBeDefined();
        expect(documentationUpdate.completedAt!.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
        expect(documentationUpdate.completedAt!.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
      });

      it('should update notes when provided', () => {
        const notes = 'Documentation updated successfully';
        documentationUpdate.updateStatus('completed', notes);
        expect(documentationUpdate.completionNotes).toBe(notes);
      });

      it('should update assigned user when provided', () => {
        const assignedTo = 'user-123';
        documentationUpdate.updateStatus('in_progress', undefined, assignedTo);
        expect(documentationUpdate.assignedTo).toBe(assignedTo);
      });

      it('should update all parameters when provided', () => {
        const notes = 'Work in progress';
        const assignedTo = 'user-456';
        documentationUpdate.updateStatus('in_progress', notes, assignedTo);

        expect(documentationUpdate.status).toBe('in_progress');
        expect(documentationUpdate.completionNotes).toBe(notes);
        expect(documentationUpdate.assignedTo).toBe(assignedTo);
      });
    });

    describe('setDueDate', () => {
      it('should set due date based on high priority (1 day)', () => {
        const beforeSet = new Date();
        documentationUpdate.setDueDate('high');
        const afterSet = new Date();

        expect(documentationUpdate.dueDate).toBeDefined();
        const expectedDate = new Date(beforeSet);
        expectedDate.setDate(expectedDate.getDate() + 1);

        // Allow for some time variance in test execution
        const actualDueDate = documentationUpdate.dueDate!;
        expect(actualDueDate.getTime()).toBeGreaterThanOrEqual(expectedDate.getTime() - 1000);
        expect(actualDueDate.getTime()).toBeLessThanOrEqual(expectedDate.getTime() + 1000);
      });

      it('should set due date based on medium priority (3 days)', () => {
        documentationUpdate.setDueDate('medium');
        expect(documentationUpdate.dueDate).toBeDefined();

        const now = new Date();
        const expectedDate = new Date(now);
        expectedDate.setDate(expectedDate.getDate() + 3);

        const actualDate = documentationUpdate.dueDate!;
        expect(Math.abs(actualDate.getTime() - expectedDate.getTime())).toBeLessThan(2000); // 2 second tolerance
      });

      it('should set due date based on low priority (7 days)', () => {
        documentationUpdate.setDueDate('low');
        expect(documentationUpdate.dueDate).toBeDefined();

        const now = new Date();
        const expectedDate = new Date(now);
        expectedDate.setDate(expectedDate.getDate() + 7);

        const actualDate = documentationUpdate.dueDate!;
        expect(Math.abs(actualDate.getTime() - expectedDate.getTime())).toBeLessThan(2000); // 2 second tolerance
      });

      it('should use entity priority when no priority parameter provided', () => {
        documentationUpdate.priority = 'high';
        documentationUpdate.setDueDate();

        expect(documentationUpdate.dueDate).toBeDefined();
        
        const now = new Date();
        const expectedDate = new Date(now);
        expectedDate.setDate(expectedDate.getDate() + 1); // high priority = 1 day

        const actualDate = documentationUpdate.dueDate!;
        expect(Math.abs(actualDate.getTime() - expectedDate.getTime())).toBeLessThan(2000);
      });
    });
  });

  describe('Analysis Result Integration', () => {
    it('should store complete analysis result', () => {
      expect(documentationUpdate.analysisResult).toEqual(mockAnalysisResult);
      expect(documentationUpdate.analysisResult.shouldUpdate).toBe(true);
      expect(documentationUpdate.analysisResult.confidence).toBe(85);
      
      // Check that the readme update should be set correctly
      const readmeUpdate = documentationUpdate.analysisResult.suggestedUpdates.readme;
      expect(readmeUpdate).toBeDefined();
      expect(readmeUpdate!.shouldUpdate).toBe(true);
    });

    it('should store change context', () => {
      expect(documentationUpdate.changeContext?.commits.count).toBe(3);
      expect(documentationUpdate.changeContext?.changes.added).toBe(2);
      expect(documentationUpdate.changeContext?.complexity.average).toBe(5.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing optional fields gracefully', () => {
      const minimalUpdate = new DocumentationUpdate();
      minimalUpdate.repositoryId = 'repo-123';
      minimalUpdate.reasoning = 'Test';
      minimalUpdate.analysisResult = {
        shouldUpdate: false,
        confidence: 0,
        reasoning: 'No changes',
        suggestedUpdates: {},
        metadata: {
          analysisDate: '2024-01-01T00:00:00Z',
          llmModel: 'gpt-4',
          processingTime: 100,
        },
      };

      expect(minimalUpdate.estimatedEffort).toBe('small');
      expect(minimalUpdate.priorityScore).toBeNaN(); // Due to undefined priority and confidence
      expect(minimalUpdate.isOverdue).toBe(false);
    });

    it('should handle empty suggested updates', () => {
      documentationUpdate.analysisResult.suggestedUpdates = {};
      expect(documentationUpdate.estimatedEffort).toBe('medium'); // Because priority is 'medium' by default
    });
  });
}); 